import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, ChevronDown, ChevronUp, Download, ImageIcon, Loader2, VideoOff } from 'lucide-react';
import { products, productById, type Product } from '../lib/catalog';
import { loadAnalysis } from '../lib/analysisStore';
import { detectFace, loadFaceModel, trackVideo } from '../lib/faceModel';
import { facePose, PoseSmoother } from '../three/faceAnchor';
import { TryOnRenderer } from '../three/TryOnRenderer';
import FrameImage from '../components/frames/FrameImage';
import { probeLight } from '../lib/lightProbe';

type Source = 'camera' | 'photo';

export default function Essayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const analysis = useMemo(() => loadAnalysis(), []);
  const product: Product = productById(id ?? '') ?? products[0];
  const [source, setSource] = useState<Source>(analysis && !id ? 'photo' : 'camera');
  const [status, setStatus] = useState<'loading' | 'searching' | 'tracking' | 'denied' | 'error'>('loading');
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  // height on the nose, per frame model, in mm (+ = higher)
  const [nudge, setNudge] = useState(0);
  const nudgeRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tryOnRef = useRef<TryOnRenderer | null>(null);

  // renderer lifetime
  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new TryOnRenderer(canvasRef.current);
    tryOnRef.current = r;
    return () => {
      r.dispose();
      tryOnRef.current = null;
    };
  }, []);

  // frame changes
  useEffect(() => {
    tryOnRef.current?.setSpec(product.spec);
    if (source === 'photo') renderPhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, source]);

  // Head pose of the analysis photo: refined by the model when it is available.
  const photoMatrix = useRef<number[] | null>(null);
  const renderPhoto = useCallback(() => {
    const r = tryOnRef.current;
    if (!r || !analysis) return;
    r.setSize(analysis.photoWidth, analysis.photoHeight);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) {
      const c = document.createElement('canvas');
      c.width = analysis.photoWidth;
      c.height = analysis.photoHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      r.setLight(probeLight(ctx, analysis.landmarks), 1);
    }
    r.setNudge(nudgeRef.current);
    r.update(facePose(analysis.landmarks, photoMatrix.current), analysis.landmarks);
    r.render();
    setStatus('tracking');
  }, [analysis]);

  useEffect(() => {
    if (source !== 'photo' || !analysis || photoMatrix.current) return;
    const img = new Image();
    img.src = analysis.photo;
    img.decode()
      .then(() => detectFace(img))
      .then((t) => {
        if (t?.matrix) {
          photoMatrix.current = t.matrix;
          renderPhoto();
        }
      })
      .catch(() => undefined);
  }, [source, analysis, renderPhoto]);

  const changeNudge = (delta: number) => {
    const v = Math.max(-6, Math.min(6, nudgeRef.current + delta));
    nudgeRef.current = v;
    setNudge(v);
    if (source === 'photo') renderPhoto();
  };
  useEffect(() => {
    nudgeRef.current = 0;
    setNudge(0);
  }, [product.id]);

  // camera mode: stream + tracking loop
  useEffect(() => {
    if (source !== 'camera') return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let raf = 0;
    const smoother = new PoseSmoother();
    setStatus('loading');

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
      } catch {
        if (!stopped) setStatus('denied');
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      try {
        await loadFaceModel('VIDEO');
      } catch {
        if (!stopped) setStatus('error');
        return;
      }
      if (stopped) return;
      setStatus('searching');
      let busy = false;
      let frameCount = 0;
      const grab = document.createElement('canvas');
      let sizedFor = '';
      const tick = async () => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        const r = tryOnRef.current;
        if (busy || !r || video.readyState < 2) return;
        busy = true;
        try {
          const key = `${video.videoWidth}x${video.videoHeight}`;
          if (key !== sizedFor) {
            r.setSize(video.videoWidth, video.videoHeight);
            sizedFor = key;
          }
          // Grab the frame first, analyse that exact image, then show it with its overlay:
          // the picture and the frame on it always come from the same instant.
          if (grab.width !== video.videoWidth) {
            grab.width = video.videoWidth;
            grab.height = video.videoHeight;
          }
          const gctx = grab.getContext('2d', { willReadFrequently: true })!;
          gctx.drawImage(video, 0, 0);
          const track = await trackVideo(grab);
          const fc = frameRef.current;
          if (fc) {
            if (fc.width !== grab.width) {
              fc.width = grab.width;
              fc.height = grab.height;
            }
            fc.getContext('2d')!.drawImage(grab, 0, 0);
          }
          frameCount++;
          if (track) {
            if (frameCount % 6 === 0) r.setLight(probeLight(gctx, track.landmarks));
            r.setNudge(nudgeRef.current);
            r.update(smoother.smooth(facePose(track.landmarks, track.matrix), performance.now()), track.landmarks);
            setStatus('tracking');
          } else {
            smoother.reset();
            r.update(null);
            setStatus('searching');
          }
          r.render();
        } finally {
          busy = false;
        }
      };
      tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [source]);

  const takeShot = () => {
    const base = source === 'camera' ? frameRef.current : imgRef.current;
    const overlay = canvasRef.current;
    if (!base || !overlay) return;
    const w = overlay.width;
    const h = overlay.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.translate(w, 0);
    ctx.scale(-1, 1); // same mirror as on screen
    ctx.drawImage(base, 0, 0, w, h);
    ctx.drawImage(overlay, 0, 0, w, h);
    setShotUrl(c.toDataURL('image/jpeg', 0.92));
  };

  const pick = (p: Product) => navigate(`/essayer/${p.id}`, { replace: true });

  const message =
    status === 'loading'
      ? 'Ouverture de la caméra…'
      : status === 'searching'
      ? 'Place ton visage face à la caméra'
      : status === 'denied'
      ? null
      : status === 'error'
      ? 'Le suivi du visage n’a pas pu démarrer. Vérifie ta connexion puis recharge la page.'
      : null;

  return (
    <div className="bg-ink min-h-[calc(100dvh-64px)] text-paper">
      <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:p-8">
        {/* stage */}
        <div className="relative w-full aspect-[3/4] lg:aspect-[4/3] lg:rounded-stage overflow-hidden bg-[#0e1420]">
          <div className="absolute inset-0 -scale-x-100">
            {source === 'camera' ? (
              <>
                <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
                <canvas ref={frameRef} className="absolute inset-0 w-full h-full object-cover" />
              </>
            ) : (
              analysis && (
                <img ref={imgRef} src={analysis.photo} alt="" onLoad={renderPhoto} className="absolute inset-0 w-full h-full object-cover" />
              )
            )}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
          </div>

          {message && (
            <div className="absolute inset-x-0 bottom-5 flex justify-center px-6" aria-live="polite">
              <span className="flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-4 py-2 text-sm">
                {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                {message}
              </span>
            </div>
          )}
          {status === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
              <VideoOff className="h-9 w-9 text-mist mb-4" />
              <p className="font-semibold">La caméra est bloquée</p>
              <p className="text-sm text-mist mt-1 max-w-xs">
                Autorise la caméra dans les réglages du navigateur
                {analysis ? ', ou essaie la monture sur la photo de ton analyse.' : '.'}
              </p>
            </div>
          )}

          {/* source switch */}
          {analysis && (
            <div className="absolute top-4 left-4 flex rounded-full bg-black/45 backdrop-blur p-1 text-sm">
              {(
                [
                  ['camera', 'En direct', Camera],
                  ['photo', 'Ma photo', ImageIcon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => setSource(value)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                    source === value ? 'bg-paper text-ink' : 'text-paper/80'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {status === 'tracking' && (
            <div className="absolute bottom-5 left-5 flex flex-col rounded-full bg-black/45 backdrop-blur text-paper" role="group" aria-label="Hauteur de la monture">
              <button onClick={() => changeNudge(1)} disabled={nudge >= 6} aria-label="Remonter la monture" className="h-11 w-11 flex items-center justify-center disabled:opacity-30">
                <ChevronUp className="h-5 w-5" />
              </button>
              <button onClick={() => changeNudge(-1)} disabled={nudge <= -6} aria-label="Descendre la monture" className="h-11 w-11 flex items-center justify-center disabled:opacity-30">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          )}

          <button
            onClick={takeShot}
            disabled={status !== 'tracking'}
            aria-label="Prendre une photo avec la monture"
            className="absolute bottom-5 right-5 h-14 w-14 rounded-full bg-paper text-ink flex items-center justify-center shadow-lg disabled:opacity-0 transition-opacity"
          >
            <Camera className="h-6 w-6" />
          </button>
        </div>

        {/* details + picker */}
        <aside className="px-5 pt-5 pb-8 lg:p-0">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm text-mist">{product.brand}</p>
              <h1 className="wide font-extrabold text-2xl leading-tight">{product.name}</h1>
            </div>
            <p className="tnum text-xl font-semibold">{product.price} €</p>
          </div>
          <p className="marking !text-mist mt-1">{product.marking}</p>
          <p className="text-sm text-paper/70 mt-3">
            Affichée à taille réelle : {product.width} mm de large, mesurés sur ton iris.
          </p>
          <Link to={`/montures/${product.id}`} className="btn-line !border-paper/25 !text-paper hover:!border-paper w-full mt-5">
            Voir la fiche
          </Link>

          <h2 className="text-sm text-mist mt-8 mb-3">Autres montures</h2>
          <div className="flex lg:grid lg:grid-cols-2 gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 lg:mx-0 lg:px-0 snap-x">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                aria-pressed={p.id === product.id}
                className={`snap-start shrink-0 w-32 lg:w-auto rounded-tile p-2 text-left transition-colors ${
                  p.id === product.id ? 'bg-paper text-ink' : 'bg-white/[0.06] hover:bg-white/[0.12]'
                }`}
              >
                <FrameImage spec={p.spec} alt={p.name} view="front" size={360} />
                <span className="block text-xs mt-1 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {shotUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setShotUrl(null)}>
          <div className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img src={shotUrl} alt={`Toi avec ${product.name}`} className="w-full rounded-stage" />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <a href={shotUrl} download={`luxoptic-${product.id}.jpg`} className="btn bg-paper text-ink">
                <Download className="h-5 w-5" /> Enregistrer
              </a>
              <button onClick={() => setShotUrl(null)} className="btn border border-paper/30 text-paper">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
