import type { Capture } from '../components/analysis/CaptureStep';
import { averageLandmarks, analyzeSkin, computeMetrics } from './faceMetrics';
import type { AnalysisResult } from './analysisStore';
import type { Profile } from './recommendations';

const OUTPUT_HEIGHT = 720;

/** Turns a raw capture into the stored report: metrics + a portrait crop with landmarks. */
export function buildResult(capture: Capture, profile: Profile): AnalysisResult {
  const p = averageLandmarks(capture.sets);
  const src = capture.canvas;
  const skin = analyzeSkin(src.getContext('2d', { willReadFrequently: true })!, p);
  const metrics = computeMetrics(p, skin);

  // Portrait crop (3:4) centred on the face.
  const faceH = p[152].y - p[10].y;
  let h = Math.min(src.height, faceH * 2.1);
  let w = h * 0.75;
  if (w > src.width) {
    w = src.width;
    h = w / 0.75;
  }
  const cx = (p[234].x + p[454].x) / 2;
  const cy = (p[10].y + p[152].y) / 2 - faceH * 0.05;
  const x0 = Math.round(Math.min(Math.max(0, cx - w / 2), src.width - w));
  const y0 = Math.round(Math.min(Math.max(0, cy - h / 2), src.height - h));
  const scale = Math.min(1, OUTPUT_HEIGHT / h);

  const out = document.createElement('canvas');
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  out.getContext('2d')!.drawImage(src, x0, y0, w, h, 0, 0, out.width, out.height);

  return {
    profile,
    metrics,
    photo: out.toDataURL('image/jpeg', 0.85),
    photoWidth: out.width,
    photoHeight: out.height,
    landmarks: p.map((q) => [
      Math.round((q.x - x0) * scale * 10) / 10,
      Math.round((q.y - y0) * scale * 10) / 10,
      Math.round((q.z ?? 0) * scale * 10) / 10,
    ]),
    createdAt: new Date().toISOString(),
  };
}
