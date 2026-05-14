const NAVER_AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';
const STORAGE_KEY = 'naver_oauth_state';

const naverClientId = import.meta.env.VITE_NAVER_CLIENT_ID as string | undefined;

type PendingAuth = {
  state: string;
  redirectUri: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return buffer;
}

function getRedirectUri(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${window.location.origin}${base}`;
}

export function redirectToNaverLogin(): void {
  if (!naverClientId) {
    throw new Error('네이버 Client ID (VITE_NAVER_CLIENT_ID) 가 설정되지 않았습니다.');
  }

  const state = base64UrlEncode(randomBytes(16));
  const redirectUri = getRedirectUri();

  const pending: PendingAuth = { state, redirectUri };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

  const url = new URL(NAVER_AUTHORIZE_URL);
  url.searchParams.set('client_id', naverClientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  window.location.assign(url.toString());
}

export function consumeNaverCallback(): {
  code: string;
  state: string;
  redirectUri: string;
} | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  let pending: PendingAuth;
  try {
    pending = JSON.parse(stored) as PendingAuth;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    cleanQueryString();
    return null;
  }

  if (state !== pending.state) {
    sessionStorage.removeItem(STORAGE_KEY);
    cleanQueryString();
    throw new Error('네이버 인증 state 검증에 실패했습니다.');
  }

  sessionStorage.removeItem(STORAGE_KEY);
  cleanQueryString();

  return { code, state, redirectUri: pending.redirectUri };
}

function cleanQueryString(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}
