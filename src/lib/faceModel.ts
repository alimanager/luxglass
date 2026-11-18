import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Face tracking with MediaPipe Face Landmarker (tasks-vision): 478 landmarks
 * (468 mesh + 10 iris) and a head-pose matrix, on the GPU when available.
 *
 * The WASM runtime is served from our own origin (see vite.config.ts).
 * The model (~3.7 MB) is loaded from VITE_FACE_MODEL_URL, by default Google's
 * official URL. To self-host it, put face_landmarker.task in public/models/ and set
 * VITE_FACE_MODEL_URL=/models/face_landmarker.task.
 */

export type Point = { x: number; y: number; z?: number };

export interface FaceTrack {
  /** landmarks in source pixels (z on the same scale as x, smaller = closer) */
  landmarks: Point[];
  /** 4x4 column-major head transform (canonical face → camera), if available */
  matrix: number[] | null;
}

const MODEL_URL =
  import.meta.env.VITE_FACE_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Mode = 'IMAGE' | 'VIDEO';
const instances: Partial<Record<Mode, Promise<FaceLandmarker>>> = {};
let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;

async function create(mode: Mode, delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  fileset ??= FilesetResolver.forVisionTasks('/mediapipe/wasm');
  return FaceLandmarker.createFromOptions(await fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: mode,
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  });
}

function landmarker(mode: Mode): Promise<FaceLandmarker> {
  if (!instances[mode]) {
    instances[mode] = create(mode, 'GPU')
      .catch(() => create(mode, 'CPU')) // some phones refuse the GPU delegate
      .catch((err) => {
        console.error('Face model failed to load', err);
        delete instances[mode];
        throw err;
      });
  }
  return instances[mode]!;
}

/** Preloads the model (call early, e.g. on the intro screen). */
export function loadFaceModel(mode: Mode = 'IMAGE'): Promise<unknown> {
  return landmarker(mode);
}

const size = (s: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) =>
  s instanceof HTMLVideoElement
    ? { w: s.videoWidth, h: s.videoHeight }
    : s instanceof HTMLImageElement
    ? { w: s.naturalWidth, h: s.naturalHeight }
    : { w: s.width, h: s.height };

function toTrack(
  result: ReturnType<FaceLandmarker['detect']>,
  w: number,
  h: number
): FaceTrack | null {
  const lm = result.faceLandmarks?.[0];
  if (!lm || lm.length < 478) return null;
  return {
    landmarks: lm.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w })),
    matrix: result.facialTransformationMatrixes?.[0]?.data ? Array.from(result.facialTransformationMatrixes[0].data) : null,
  };
}

/** Single image or canvas (analysis, photo try-on). */
export async function detectFace(source: HTMLCanvasElement | HTMLImageElement): Promise<FaceTrack | null> {
  const fl = await landmarker('IMAGE');
  const { w, h } = size(source);
  return toTrack(fl.detect(source), w, h);
}

let lastTs = 0;
/** Live video: uses temporal tracking between frames, much cheaper than per-image detection. */
export async function trackVideo(frame: HTMLVideoElement | HTMLCanvasElement): Promise<FaceTrack | null> {
  const fl = await landmarker('VIDEO');
  const ts = Math.max(performance.now(), lastTs + 1); // timestamps must increase
  lastTs = ts;
  const { w, h } = size(frame);
  return toTrack(fl.detectForVideo(frame, ts), w, h);
}

/** Landmarks only (analysis helpers). */
export async function detectLandmarks(source: HTMLCanvasElement | HTMLImageElement): Promise<Point[] | null> {
  return (await detectFace(source))?.landmarks ?? null;
}
