import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GalleryImage } from '../content/wedding';
import { Lightbox } from './Lightbox';

const AUTO_ADVANCE_MS = 6500;

export function Gallery({ images }: { images: readonly GalleryImage[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const total = images.length;
  const goTo = (next: number) => setIndex(((next % total) + total) % total);

  useEffect(() => {
    if (paused || total <= 1 || lightboxIndex !== null) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, total, lightboxIndex]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + total) % total);
      } else if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % total);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  return (
    <div
      className="gallery-stage"
      role="region"
      aria-label="결혼 사진 갤러리"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="gallery-frame">
        {images.map((image, i) => (
          <figure
            className={`gallery-slide ${i === index ? 'is-active' : ''}`}
            key={image.id}
            data-gallery-id={image.id}
            aria-hidden={i !== index}
            onClick={() => i === index && setLightboxIndex(i)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <img
              src={image.src}
              alt={image.alt}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
              style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
            />
            <figcaption>{image.caption}</figcaption>
          </figure>
        ))}
      </div>

      <button
        type="button"
        className="gallery-nav gallery-nav--prev"
        onClick={() => goTo(index - 1)}
        aria-label="이전 사진"
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="gallery-nav gallery-nav--next"
        onClick={() => goTo(index + 1)}
        aria-label="다음 사진"
      >
        <ChevronRight size={22} aria-hidden="true" />
      </button>

      <div className="gallery-indicator" aria-hidden="true">
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            className={i === index ? 'is-active' : ''}
            onClick={() => goTo(i)}
            tabIndex={-1}
          />
        ))}
      </div>

      {lightboxIndex !== null ? (
        <Lightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}
