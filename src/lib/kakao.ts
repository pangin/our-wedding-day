const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const STORAGE_KEY = 'kakao_oauth_pkce';

const kakaoJsKey =
  (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ??
  (import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined);

type PendingAuth = {
  verifier: string;
  state: string;
  nonce: string;
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

async function sha256(input: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return new Uint8Array(hash);
}

function getRedirectUri(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${window.location.origin}${base}`;
}

export async function redirectToKakaoLogin(): Promise<void> {
  if (!kakaoJsKey) {
    throw new Error('Kakao JavaScript 키 (VITE_KAKAO_MAP_KEY) 가 설정되지 않았습니다.');
  }

  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = base64UrlEncode(randomBytes(16));
  const nonce = base64UrlEncode(randomBytes(16));
  const nonceHash = base64UrlEncode(await sha256(nonce));
  const redirectUri = getRedirectUri();

  const pending: PendingAuth = { verifier, state, nonce, redirectUri };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

  const url = new URL(KAKAO_AUTHORIZE_URL);
  url.searchParams.set('client_id', kakaoJsKey);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile_nickname profile_image');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonceHash);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(url.toString());
}

export async function consumeKakaoCallback(): Promise<
  { idToken: string; nonce: string } | null
> {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    cleanQueryString();
    return null;
  }

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
    throw new Error('카카오 인증 state 검증에 실패했습니다.');
  }

  if (!kakaoJsKey) {
    sessionStorage.removeItem(STORAGE_KEY);
    throw new Error('Kakao JavaScript 키가 설정되지 않았습니다.');
  }

  const response = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: kakaoJsKey,
      redirect_uri: pending.redirectUri,
      code,
      code_verifier: pending.verifier,
    }).toString(),
  });

  sessionStorage.removeItem(STORAGE_KEY);

  if (!response.ok) {
    const text = await response.text();
    cleanQueryString();
    throw new Error(`Kakao 토큰 교환 실패: ${text}`);
  }

  const data = (await response.json()) as { id_token?: string };
  cleanQueryString();

  if (!data.id_token) {
    throw new Error(
      'Kakao 응답에 id_token 이 없습니다. Kakao Developers Console 의 OpenID Connect 활성화 여부를 확인해 주세요.',
    );
  }

  return { idToken: data.id_token, nonce: pending.nonce };
}

function cleanQueryString(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}
