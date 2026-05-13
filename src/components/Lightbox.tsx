import { useEffect, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryImage } from '../content/wedding';

export function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: readonly GalleryImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const total = images.length;
  const current = images[index];

  function goTo(next: number) {
    setIndex(((next % total) + total) % total);
  }

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + total) % total);
      } else if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % total);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${current.caption} - ${current.alt}`}
      onClick={onClose}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        className="lightbox__close"
        type="button"
        onClick={(event) => {
          stop(event);
          onClose();
        }}
        aria-label="닫기"
      >
        <X size={24} aria-hidden="true" />
      </button>

      <button
        className="lightbox__nav lightbox__nav--prev"
        type="button"
        onClick={(event) => {
          stop(event);
          goTo(index - 1);
        }}
        aria-label="이전 사진"
      >
        <ChevronLeft size={28} aria-hidden="true" />
      </button>

      <div
        className="lightbox__frame"
        style={{ backgroundImage: `url("${current.full}")` }}
        onClick={stop}
        role="img"
        aria-label={current.alt}
      />

      <button
        className="lightbox__nav lightbox__nav--next"
        type="button"
        onClick={(event) => {
          stop(event);
          goTo(index + 1);
        }}
        aria-label="다음 사진"
      >
        <ChevronRight size={28} aria-hidden="true" />
      </button>

      <div className="lightbox__meta" aria-hidden="true">
        <span className="lightbox__caption">{current.caption}</span>
        <span className="lightbox__counter">
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}
