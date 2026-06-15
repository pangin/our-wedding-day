export type Venue = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type MapProvider = 'kakao' | 'naver' | 'tmap' | 'google';

export type Platform = 'ios' | 'android' | 'desktop';

export type OpenResult =
  | { kind: 'opened' }
  | { kind: 'desktopUnsupported'; message: string };

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function enc(value: string | number) {
  return encodeURIComponent(String(value));
}

function appName(): string {
  if (typeof window === 'undefined') return 'wedding';
  return window.location.host || 'wedding';
}

type MapUrls = {
  web: string;
  iosScheme?: string;
  androidIntent?: string;
};

function buildUrls(provider: MapProvider, venue: Venue): MapUrls {
  const { lat, lng, name, address } = venue;
  const fullQuery = enc(`${name} ${address}`);
  const placeName = enc(name);

  switch (provider) {
    case 'kakao': {
      const web = `https://map.kakao.com/link/map/${placeName},${lat},${lng}`;
      const iosScheme = `kakaomap://look?p=${lat},${lng}`;
      const androidIntent = `intent://look?p=${lat},${lng}#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=${enc(web)};end`;
      return { web, iosScheme, androidIntent };
    }
    case 'naver': {
      const app = enc(appName());
      const web = `https://map.naver.com/p/search/${fullQuery}`;
      const iosScheme = `nmap://place?lat=${lat}&lng=${lng}&name=${placeName}&appname=${app}`;
      const androidIntent = `intent://place?lat=${lat}&lng=${lng}&name=${placeName}&appname=${app}#Intent;scheme=nmap;package=com.nhn.android.nmap;S.browser_fallback_url=${enc(web)};end`;
      return { web, iosScheme, androidIntent };
    }
    case 'tmap': {
      // goalx = longitude, goaly = latitude (SK Telecom's URL-scheme convention).
      // Lowercase goalname/goalx/goaly works on both iOS and Android per community testing.
      const route = `route?goalname=${placeName}&goalx=${lng}&goaly=${lat}`;
      // Fallback when TMAP isn't installed: Kakao Map coordinate-pin link works in any mobile browser.
      const web = `https://map.kakao.com/link/map/${placeName},${lat},${lng}`;
      const iosScheme = `tmap://${route}`;
      const androidIntent = `intent://${route}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${enc(web)};end`;
      return { web, iosScheme, androidIntent };
    }
    case 'google': {
      const web = `https://www.google.com/maps/search/?api=1&query=${fullQuery}`;
      return { web };
    }
  }
}

export function openMap(provider: MapProvider, venue: Venue): OpenResult {
  if (typeof window === 'undefined') return { kind: 'opened' };

  const platform = detectPlatform();

  if (provider === 'tmap' && platform === 'desktop') {
    return { kind: 'desktopUnsupported', message: 'TMAP은 모바일 앱에서만 지원합니다.' };
  }

  const urls = buildUrls(provider, venue);

  if (platform === 'desktop' || provider === 'google') {
    window.open(urls.web, '_blank', 'noopener,noreferrer');
    return { kind: 'opened' };
  }

  if (platform === 'android' && urls.androidIntent) {
    window.location.href = urls.androidIntent;
    return { kind: 'opened' };
  }

  if (platform === 'ios' && urls.iosScheme) {
    const scheme = urls.iosScheme;
    const fallback = urls.web;
    const start = Date.now();
    window.location.href = scheme;
    window.setTimeout(() => {
      if (Date.now() - start < 1500 && document.visibilityState === 'visible') {
        window.location.href = fallback;
      }
    }, 1200);
    return { kind: 'opened' };
  }

  window.open(urls.web, '_blank', 'noopener,noreferrer');
  return { kind: 'opened' };
}
