import { useEffect, useState } from 'react';
import type { FrameSpec } from '../../three/frameSpec';
import { renderThumbnail, type ThumbView } from '../../three/studio';

/** A studio render of a frame, generated once in the browser and cached. */
export default function FrameImage({
  spec,
  alt,
  view = 'three-quarter',
  size = 640,
  className = '',
}: {
  spec: FrameSpec;
  alt: string;
  view?: ThumbView;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    renderThumbnail(spec, view, size).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [spec, view, size]);
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
