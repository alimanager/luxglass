import type { FaceMetrics } from './faceMetrics';
import type { Profile } from './recommendations';

export interface AnalysisResult {
  profile: Profile;
  metrics: FaceMetrics;
  /** JPEG data URL of the (unmirrored) capture, downscaled */
  photo: string;
  photoWidth: number;
  photoHeight: number;
  /** Landmarks in photo pixel coordinates */
  landmarks: [number, number][];
  createdAt: string;
}

const KEY = 'luxglass.analysis.v1';

export function saveAnalysis(result: AnalysisResult) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    // storage full or unavailable: the report still gets the result via router state
  }
}

export function loadAnalysis(): AnalysisResult | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnalysisResult) : null;
  } catch {
    return null;
  }
}
