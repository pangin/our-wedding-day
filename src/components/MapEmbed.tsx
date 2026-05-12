import { useEffect, useRef, useState } from 'react';
import type { Venue } from '../lib/mapLinks';

type KakaoLatLng = unknown;
type KakaoMap = unknown;

type KakaoSDK = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number },
    ) => KakaoMap;
    Marker: new (options: { position: KakaoLatLng; map: KakaoMap }) => unknown;
  };
};

declare global {
  interface Window {
    kakao?: KakaoSDK;
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;

let sdkPromise: Promise<KakaoSDK> | null = null;

function loadKakaoSDK(key: string): Promise<KakaoSDK> {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-sdk="true"]',
    );
    const onReady = () => {
      if (window.kakao?.maps) resolve(window.kakao);
      else reject(new Error('Kakao SDK initialized without maps namespace'));
    };

    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Kakao SDK script failed to load')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.async = true;
    script.dataset.kakaoSdk = 'true';
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Kakao SDK script failed to load')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export function MapEmbed({ venue }: { venue: Venue }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!KAKAO_KEY) return;
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    loadKakaoSDK(KAKAO_KEY)
      .then((sdk) => {
        if (cancelled) return;
        sdk.maps.load(() => {
          if (cancelled || !containerRef.current) return;
          const center = new sdk.maps.LatLng(venue.lat, venue.lng);
          const map = new sdk.maps.Map(containerRef.current, {
            center,
            level: 3,
          });
          new sdk.maps.Marker({ position: center, map });
        });
      })
      .catch((err) => {
        console.warn('[MapEmbed] Kakao SDK load failed', err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [venue.lat, venue.lng]);

  if (!KAKAO_KEY || error) {
    return (
      <div className="map-embed map-embed--fallback">
        <p className="map-embed__title">{venue.name}</p>
        <p className="map-embed__subtitle">{venue.address}</p>
        <p className="map-embed__hint">
          아래 “지도 열기” 버튼으로 원하는 지도 앱에서 확인하실 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="map-embed"
      role="img"
      aria-label={`${venue.name} 위치 지도`}
    />
  );
}
