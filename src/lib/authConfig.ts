type AuthProvider = 'kakao' | 'google' | 'naver';

function isEnabled(value: string | undefined): boolean {
  return value !== 'false';
}

export const AUTH_ENABLED: Record<AuthProvider, boolean> = {
  kakao: isEnabled(import.meta.env.VITE_AUTH_KAKAO_ENABLED as string | undefined),
  google: isEnabled(import.meta.env.VITE_AUTH_GOOGLE_ENABLED as string | undefined),
  naver: isEnabled(import.meta.env.VITE_AUTH_NAVER_ENABLED as string | undefined),
};

export type { AuthProvider };
