import React, { useMemo } from 'react';

interface FacePhotoProps {
  photo: string;
  width: number;
  height: number;
  landmarks: number[][];
  /** 0–1: share of mesh points shown (scan effect, top to bottom) */
  reveal?: number;
  showMesh?: boolean;
  showGuides?: boolean;
  className?: string;
}

const GUIDES: [number, number][] = [
  [10, 152], // midline
  [234, 454], // cheek width
  [172, 397], // jaw
  [103, 332], // forehead
  [468, 473], // pupils
];

/** Selfie photo (displayed mirrored, like a mirror) with the landmark mesh drawn on top. */
const FacePhoto: React.FC<FacePhotoProps> = ({
  photo,
  width,
  height,
  landmarks,
  reveal = 1,
  showMesh = true,
  showGuides = false,
  className = '',
}) => {
  const order = useMemo(
    () => landmarks.map((_, i) => i).sort((a, b) => landmarks[a][1] - landmarks[b][1]),
    [landmarks]
  );
  const visible = Math.round(order.length * reveal);
  const r = Math.max(1.1, width / 360);
  const scanY = reveal < 1 && visible > 0 ? landmarks[order[visible - 1]][1] : null;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute inset-0 -scale-x-100">
        <img src={photo} alt="Ta photo" className="absolute inset-0 w-full h-full object-cover" />
        <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 w-full h-full">
          {showMesh &&
            order.slice(0, visible).map((i) => (
              <circle key={i} cx={landmarks[i][0]} cy={landmarks[i][1]} r={i >= 468 ? r * 1.4 : r} fill={i >= 468 ? '#e9c48f' : 'rgba(255,255,255,0.75)'} />
            ))}
          {scanY !== null && (
            <line x1={0} x2={width} y1={scanY} y2={scanY} stroke="#e9c48f" strokeWidth={r * 1.5} opacity={0.8} />
          )}
          {showGuides &&
            GUIDES.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={landmarks[a][0]}
                y1={landmarks[a][1]}
                x2={landmarks[b][0]}
                y2={landmarks[b][1]}
                stroke="#e9c48f"
                strokeWidth={r * 1.2}
                strokeDasharray={`${r * 4} ${r * 3}`}
                className="animate-fade-in"
              />
            ))}
        </svg>
      </div>
    </div>
  );
};

export default FacePhoto;
