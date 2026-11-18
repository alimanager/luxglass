import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, ShieldCheck, VideoOff } from 'lucide-react';
import { detectLandmarks, loadFaceModel, type Point } from '../../lib/faceModel';
import { checkQuality, faceLuma, ISSUE_HINT, type FrameBox, type QualityIssue } from '../../lib/captureQuality';
import { PrimaryButton } from './StepShell';

export interface Capture {
  /** full-resolution, unmirrored frame */
  canvas: HTMLCanvasElement;
  /** one or more landmark sets taken on consecutive frames */
  sets: Point[][];
}

interface CaptureStepProps {
  onCaptured: (capture: Capture) => void;
}

const VIEW_ASPECT = 3 / 4; // width / height of the camera box
const HOLD_MS = 900; // how long the pose must stay good before auto-capture
const BURST = 5;

const frameBox = (w: number, h: number): FrameBox => ({
  w,
  h,
  visibleW: Math.min(w, h * VIEW_ASPECT),
  visibleH: Math.min(h, w / VIEW_ASPECT),
});

const CaptureStep: React.FC<CaptureStepProps> = ({ onCaptured }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const fileRef = useRef<HTMLInputElement>(null);
  const [model, setModel] = useState<'loading' | 'ready' | 'error'>('loading');
  const [camera, setCamera] = useState<'pending' | 'ready' | 'denied'>('pending');
  const [issue, setIssue] = useState<QualityIssue | 'ok' | null>(null);
  const [faceFound, setFaceFound] = useState(false);
  const [hold, setHold] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadFaceModel()
      .then(() => alive && setModel('ready'))
      .catch(() => alive && setModel('error'));
    return () => {
      alive = false;
    };
  }, []);

  // Front camera stream.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then(async (s) => {
        stream = s;
        const video = videoRef.current;
        if (stopped || !video) return s.getTracks().forEach((t) => t.stop());
        video.srcObject = s;
        await video.play().catch(() => undefined);
        setCamera('ready');
      })
      .catch(() => !stopped && setCamera('denied'));
    if (!navigator.mediaDevices) setCamera('denied');
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** Draws the current video frame into the working canvas. */
  const grabFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return null;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(video, 0, 0);
    return canvas;
  }, []);

  const burst = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const sets: Point[][] = [];
    let last: HTMLCanvasElement | null = null;
    for (let attempt = 0; attempt < BURST * 3 && sets.length < BURST; attempt++) {
      const frame = grabFrame();
      if (!frame) break;
      const p = await detectLandmarks(frame);
      if (p) {
        const issues = checkQuality(p, frameBox(frame.width, frame.height), null, false);
        if (!issues.length) {
          sets.push(p);
          last = cloneCanvas(frame);
        }
      }
      await sleep(60);
    }
    if (sets.length >= 3 && last) {
      onCaptured({ canvas: last, sets });
    } else {
      setError('La photo a bougé. On recommence : reste immobile une seconde.');
      busyRef.current = false;
      setBusy(false);
      setHold(0);
    }
  }, [grabFrame, onCaptured]);

  // Live guidance loop (~8 checks per second).
  useEffect(() => {
    if (model !== 'ready' || camera !== 'ready') return;
    let stopped = false;
    let okSince: number | null = null;

    const tick = async () => {
      if (stopped || busyRef.current) return;
      const frame = grabFrame();
      if (frame) {
        try {
          const p = await detectLandmarks(frame);
          const ctx = frame.getContext('2d', { willReadFrequently: true })!;
          const luma = p ? faceLuma(ctx, p) : null;
          const issues = checkQuality(p, frameBox(frame.width, frame.height), luma, true);
          if (stopped) return;
          setFaceFound(!!p);
          if (issues.length === 0) {
            okSince = okSince ?? performance.now();
            const progress = Math.min(1, (performance.now() - okSince) / HOLD_MS);
            setIssue('ok');
            setHold(progress);
            if (progress >= 1) {
              burst();
              return;
            }
          } else {
            okSince = null;
            setHold(0);
            setIssue(issues[0]);
          }
        } catch {
          // a dropped frame is not worth surfacing
        }
      }
      if (!stopped) window.setTimeout(tick, 120);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [model, camera, grabFrame, burst]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    busyRef.current = true;
    setBusy(true);
    try {
      const img = await loadImage(file);
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const p = await detectLandmarks(canvas);
      if (!p) throw new Error('Aucun visage trouvé sur cette photo. Choisis une photo de face, bien éclairée.');
      const issues = checkQuality(p, frameBox(canvas.width, canvas.height), faceLuma(ctx, p), false);
      if (issues.includes('turned') || issues.includes('tilted')) {
        throw new Error('Sur cette photo, la tête est tournée ou penchée. Choisis une photo prise bien de face.');
      }
      onCaptured({ canvas, sets: [p] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire cette photo.');
      busyRef.current = false;
      setBusy(false);
    }
  };

  const ready = model === 'ready' && camera === 'ready';
  const hint =
    model === 'loading'
      ? 'Préparation de l’analyse…'
      : camera === 'pending'
      ? 'Autorise l’accès à la caméra'
      : busy
      ? 'Capture en cours…'
      : issue
      ? ISSUE_HINT[issue]
      : 'Place ton visage dans l’ovale';

  return (
    <div className="flex flex-col flex-1">
      <h1 className="wide font-extrabold text-3xl text-ink leading-tight">Ta photo de face</h1>
      <p className="text-graphite mt-2 mb-5 text-sm">
        Lumière naturelle de face, cheveux dégagés, sans lunettes. La photo se prend toute seule.
      </p>

      <div className="relative w-full rounded-stage overflow-hidden bg-[#0e1420]" style={{ aspectRatio: `${VIEW_ASPECT}` }}>
        {camera !== 'denied' && (
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          />
        )}

        {camera === 'denied' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 text-paper">
            <VideoOff className="h-10 w-10 mb-4 text-mist" />
            <p className="font-medium">Caméra indisponible</p>
            <p className="text-sm text-mist mt-1">Autorise la caméra dans ton navigateur, ou importe une photo de face.</p>
          </div>
        ) : (
          <OvalGuide progress={hold} active={issue === 'ok' || busy} faceFound={faceFound && ready} />
        )}

        {(!ready || busy) && camera !== 'denied' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-white/80 animate-spin" />
          </div>
        )}

        {camera !== 'denied' && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center px-4" aria-live="polite">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md transition-colors ${
                issue === 'ok' || busy ? 'bg-paper text-ink' : 'bg-black/45 text-white'
              }`}
            >
              {hint}
            </span>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger bg-shell-light rounded-xl px-4 py-3">{error}</p>}
      {model === 'error' && (
        <p className="mt-4 text-sm text-danger bg-shell-light rounded-xl px-4 py-3">
          Le moteur d’analyse n’a pas pu se charger. Vérifie ta connexion puis recharge la page.
        </p>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-mist mt-4">
        <ShieldCheck className="h-4 w-4" />
        Ta photo est analysée sur ton appareil et n’est envoyée nulle part.
      </div>

      <div className="mt-auto pt-6 space-y-3 pb-5">
        <PrimaryButton onClick={burst} disabled={!ready || !faceFound || busy}>
          <Camera className="h-5 w-5" />
          Prendre la photo
        </PrimaryButton>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={model !== 'ready' || busy}
          className="w-full h-12 rounded-[10px] text-ink font-medium flex items-center justify-center gap-2 hover:bg-glass-soft transition disabled:opacity-40"
        >
          <ImagePlus className="h-5 w-5" />
          Importer une photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
    </div>
  );
};

const OvalGuide: React.FC<{ progress: number; active: boolean; faceFound: boolean }> = ({ progress, active, faceFound }) => (
  <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
    <defs>
      <mask id="oval-cutout">
        <rect width="300" height="400" fill="white" />
        <ellipse cx="150" cy="200" rx="96" ry="128" fill="black" />
      </mask>
    </defs>
    <rect width="300" height="400" fill="rgba(20,28,31,0.55)" mask="url(#oval-cutout)" />
    <ellipse
      cx="150"
      cy="200"
      rx="96"
      ry="128"
      fill="none"
      stroke={faceFound ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}
      strokeWidth="2"
      strokeDasharray={faceFound ? undefined : '6 6'}
    />
    {/* progress ring, drawn clockwise from the top of the oval */}
    <path
      d="M150 72 A96 128 0 1 1 150 328 A96 128 0 1 1 150 72"
      fill="none"
      stroke="#e9c48f"
      strokeWidth="4"
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - (active ? Math.max(progress, 0.02) : 0)}
      style={{ transition: 'stroke-dashoffset 120ms linear', opacity: active ? 1 : 0 }}
    />
  </svg>
);

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de lire cette photo.'));
    img.src = URL.createObjectURL(file);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default CaptureStep;
