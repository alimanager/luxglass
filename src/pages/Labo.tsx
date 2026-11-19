import { useEffect, useRef, useState } from 'react';
import { detectFace } from '../lib/faceModel';
import { analyzeSkin, computeMetrics, type FaceMetrics } from '../lib/faceMetrics';
import { checkQuality, faceLuma, type QualityIssue } from '../lib/captureQuality';
import { probeLight } from '../lib/lightProbe';
import { products, type Product } from '../lib/catalog';
import { facePose } from '../three/faceAnchor';
import { TryOnRenderer } from '../three/TryOnRenderer';
import { SHAPE_INFO } from '../lib/recommendations';

/**
 * Test bench (not linked from the site): drop a batch of face photos, real or generated,
 * and every one goes through the real pipeline: detection, measurements and try-on.
 * Results can be exported as CSV to calibrate the thresholds.
 */

interface Row {
  name: string;
  /** label from the generator's manifest, if any */
  expected?: string;
  composite?: string;
  metrics?: FaceMetrics;
  issues: QualityIssue[];
  ms: number;
  error?: string;
}

const MAX_SIDE = 1024;

async function readImage(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c;
}

export default function Labo() {
  const [frameId, setFrameId] = useState<number>(products[0].id);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const overlayRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const tryOn = useRef<TryOnRenderer | null>(null);
  const manifest = useRef<Record<string, string>>({});

  useEffect(() => {
    tryOn.current = new TryOnRenderer(overlayRef.current);
    return () => tryOn.current?.dispose();
  }, []);

  const run = async (files: File[]) => {
    const r = tryOn.current;
    if (!r) return;
    setBusy(true);
    setRows([]);
    const product = products.find((p) => p.id === frameId) as Product;
    await r.setFrame(product);
    const m = files.find((f) => f.name.endsWith('manifest.json'));
    if (m) {
      const list = JSON.parse(await m.text()) as { file: string; shape: string }[];
      manifest.current = Object.fromEntries(list.map((x) => [x.file, x.shape]));
    }
    for (const file of files.filter((f) => f.type.startsWith('image/'))) {
      const t0 = performance.now();
      const row: Row = { name: file.name, expected: manifest.current[file.name], issues: [], ms: 0 };
      try {
        const canvas = await readImage(file);
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const track = await detectFace(canvas);
        if (!track) {
          row.error = 'aucun visage détecté';
        } else {
          const lm = track.landmarks;
          const frame = { w: canvas.width, h: canvas.height, visibleW: canvas.width, visibleH: canvas.height };
          row.issues = checkQuality(lm, frame, faceLuma(ctx, lm), false);
          row.metrics = computeMetrics(lm, analyzeSkin(ctx, lm));
          r.setSize(canvas.width, canvas.height);
          r.setLight(probeLight(ctx, lm), 1);
          r.update(facePose(lm, track.matrix), lm);
          r.render();
          ctx.drawImage(r.renderer.domElement, 0, 0, canvas.width, canvas.height);
          row.composite = canvas.toDataURL('image/jpeg', 0.8);
        }
      } catch (e) {
        row.error = String(e);
      }
      row.ms = Math.round(performance.now() - t0);
      setRows((rs) => [...rs, row]);
    }
    setBusy(false);
  };

  const csv = () => {
    const head = 'fichier;attendu;forme;symetrie;proportions;ecart_pupillaire_mm;largeur_visage_mm;taille;longueur_largeur;machoire;front;menton;teint;sous_ton;alertes;ms;erreur';
    const lines = rows.map((r) => {
      const m = r.metrics;
      return [
        r.name,
        r.expected ?? '',
        m?.shape ?? '',
        m?.symmetryScore ?? '',
        m?.harmonyScore ?? '',
        m?.pupillaryDistanceMm.toFixed(1) ?? '',
        m?.faceWidthMm.toFixed(1) ?? '',
        m?.frameSize ?? '',
        m?.lengthRatio.toFixed(3) ?? '',
        m?.jawRatio.toFixed(3) ?? '',
        m?.foreheadRatio.toFixed(3) ?? '',
        m?.chin ?? '',
        m?.skin.depth ?? '',
        m?.skin.undertone ?? '',
        r.issues.join(','),
        r.ms,
        r.error ?? '',
      ].join(';');
    });
    const blob = new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'luxoptic-banc-essai.csv';
    a.click();
  };

  const ok = rows.filter((r) => r.metrics).length;
  const labelled = rows.filter((r) => r.expected && r.metrics);
  const agree = labelled.filter((r) => r.expected === r.metrics!.shape).length;

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <h1 className="wide font-extrabold text-3xl">Banc d’essai</h1>
      <p className="text-graphite mt-2 max-w-[60ch]">
        Dépose un lot de photos de visages. Chacune passe par la vraie chaîne : détection, mesures et essayage. Rien
        ne quitte ton navigateur.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select value={frameId} onChange={(e) => setFrameId(Number(e.target.value))} className="h-[52px] rounded-[10px] border border-rule px-3">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="btn-ink cursor-pointer">
          {busy ? 'Analyse en cours…' : 'Choisir des photos'}
          <input
            type="file"
            accept="image/*,.json"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => e.target.files && run(Array.from(e.target.files))}
          />
        </label>
        {rows.length > 0 && !busy && (
          <button className="btn-line" onClick={csv}>
            Exporter en CSV
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-6 text-[15px]">
          {ok}/{rows.length} visages analysés
          {labelled.length > 0 && `, forme du visage conforme à l’étiquette pour ${agree}/${labelled.length}`}.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map((r) => (
          <figure key={r.name} className="text-sm">
            {r.composite ? (
              <img src={r.composite} alt="" className="w-full rounded-tile bg-glass" />
            ) : (
              <div className="aspect-[3/4] rounded-tile bg-shell-light flex items-center justify-center text-danger p-3 text-center">{r.error}</div>
            )}
            <figcaption className="mt-2">
              <span className="block truncate text-graphite">{r.name}</span>
              {r.metrics && (
                <span className="block tnum">
                  {SHAPE_INFO[r.metrics.shape].label}
                  {r.expected && r.expected !== r.metrics.shape ? ` (attendu : ${SHAPE_INFO[r.expected as keyof typeof SHAPE_INFO]?.label ?? r.expected})` : ''},{' '}
                  EP {r.metrics.pupillaryDistanceMm.toFixed(0)} mm, {r.metrics.faceWidthMm.toFixed(0)} mm
                </span>
              )}
              {r.issues.length > 0 && <span className="block text-shell">{r.issues.join(', ')}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
