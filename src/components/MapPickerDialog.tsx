import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { openMap, type MapProvider, type Venue } from '../lib/mapLinks';

type Service = {
  id: MapProvider;
  label: string;
  caption: string;
  brand: string;
  icon: string;
};

const services: Service[] = [
  {
    id: 'kakao',
    label: 'KakaoMap',
    caption: '카카오맵',
    brand: '#FEE500',
    icon: 'https://www.google.com/s2/favicons?domain=map.kakao.com&sz=128',
  },
  {
    id: 'naver',
    label: 'NaverMap',
    caption: '네이버지도',
    brand: '#03C75A',
    icon: 'https://www.google.com/s2/favicons?domain=map.naver.com&sz=128',
  },
  {
    id: 'tmap',
    label: 'TMAP',
    caption: '티맵 (모바일 전용)',
    brand: '#EB1F2A',
    icon: 'https://www.google.com/s2/favicons?domain=tmap.life&sz=128',
  },
  {
    id: 'google',
    label: 'Google Maps',
    caption: '구글 지도',
    brand: '#4285F4',
    icon: 'https://www.google.com/s2/favicons?domain=maps.google.com&sz=128',
  },
];

export function MapPickerDialog({
  open,
  venue,
  onClose,
  onNotice,
}: {
  open: boolean;
  venue: Venue;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSelect(id: MapProvider) {
    const result = openMap(id, venue);
    if (result.kind === 'desktopUnsupported') {
      onNotice(result.message);
      return;
    }
    onClose();
  }

  return (
    <div
      className="map-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
      onClick={onClose}
    >
      <div
        className="map-picker__card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="map-picker__header">
          <div>
            <p className="eyebrow">길찾기</p>
            <h3 id="map-picker-title">지도 앱 선택</h3>
            <p className="map-picker__venue">
              {venue.name} · {venue.address}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="map-picker__close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="map-picker__grid">
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              className="map-picker__service"
              style={{ ['--brand' as never]: service.brand }}
              onClick={() => handleSelect(service.id)}
            >
              <span className="map-picker__icon" aria-hidden="true">
                <img src={service.icon} alt="" loading="lazy" />
              </span>
              <span className="map-picker__label">
                <strong>{service.label}</strong>
                <small>{service.caption}</small>
              </span>
            </button>
          ))}
        </div>

        <p className="map-picker__footnote">
          앱이 설치되어 있으면 앱으로, 아니면 웹 지도로 열립니다.
        </p>
      </div>
    </div>
  );
}
