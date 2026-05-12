export interface KakaoAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface KakaoAuthLoginOptions {
  scope?: string;
  nonce?: string;
  state?: string;
  throughTalk?: boolean;
  persistAccessToken?: boolean;
  success?: (resp: KakaoAuthLoginResponse) => void;
  fail?: (err: unknown) => void;
  always?: () => void;
}

export interface KakaoSDK {
  init(appKey: string): void;
  isInitialized(): boolean;
  cleanup(): void;
  Auth: {
    login(options: KakaoAuthLoginOptions): void;
    logout(callback?: () => void): void;
    getAccessToken(): string | null;
    setAccessToken(token: string, persist?: boolean): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}
