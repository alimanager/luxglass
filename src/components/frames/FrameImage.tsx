import { useEffect, useState } from 'react';
import type { FrameSource } from '../../three/loadModel';
import { renderThumbnail, type ThumbView } from '../../three/studio';

/** A studio render of a frame, generated once in the browser and cached. */
export default function FrameImage({
  frame,
  alt,
  view = 'three-quarter',
  size = 640,
  className = '',
}: {
  frame: FrameSource;
  alt: string;
  view?: ThumbView;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    renderThumbnail(frame, view, size).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [frame, view, size]);
  return (
    <div className={`relative aspect-[1/0.62] ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain animate-fade-in" draggable={false} />
      ) : (
        <div className="absolute inset-[30%_20%] rounded-full bg-glass-deep/60 animate-pulse" aria-hidden />
      )}
    </div>
  );
}
