import type { KakaoSDK } from '../types/kakao';

const kakaoJsKey =
  (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ??
  (import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined);

async function waitForKakaoSdk(timeoutMs = 5000): Promise<KakaoSDK> {
  if (typeof window === 'undefined') {
    throw new Error('Kakao SDK 는 브라우저 환경에서만 사용할 수 있습니다.');
  }
  if (window.Kakao) return window.Kakao;

  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = window.setInterval(() => {
      if (window.Kakao) {
        window.clearInterval(timer);
        resolve(window.Kakao);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('Kakao SDK 로딩 시간이 초과되었습니다.'));
      }
    }, 100);
  });
}

async function ensureKakao(): Promise<KakaoSDK> {
  if (!kakaoJsKey) {
    throw new Error('VITE_KAKAO_JS_KEY 또는 VITE_KAKAO_MAP_KEY 가 설정되지 않았습니다.');
  }
  const Kakao = await waitForKakaoSdk();
  if (!Kakao.isInitialized()) {
    Kakao.init(kakaoJsKey);
  }
  return Kakao;
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function loginWithKakaoForIdToken(): Promise<{ idToken: string; nonce: string }> {
  const Kakao = await ensureKakao();
  const nonce = randomNonce();

  return new Promise((resolve, reject) => {
    Kakao.Auth.login({
      scope: 'openid profile_nickname profile_image',
      nonce,
      success: (resp) => {
        if (!resp.id_token) {
          reject(
            new Error(
              'Kakao 응답에 id_token 이 없습니다. Kakao Developers Console 에서 OpenID Connect 활성화 여부를 확인해 주세요.',
            ),
          );
          return;
        }
        resolve({ idToken: resp.id_token, nonce });
      },
      fail: (err) => {
        const message =
          err && typeof err === 'object' && 'error_description' in err
            ? String((err as { error_description: unknown }).error_description)
            : '카카오 인증이 취소되었거나 실패했습니다.';
        reject(new Error(message));
      },
    });
  });
}
