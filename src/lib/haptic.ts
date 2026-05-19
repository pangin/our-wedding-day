import { WebHaptics } from 'web-haptics';

let instance: WebHaptics | null = null;
let lastFiredAt = 0;

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getInstance(): WebHaptics | null {
  if (typeof window === 'undefined') return null;
  if (!instance) instance = new WebHaptics();
  return instance;
}

export function pulseSnap(): void {
  if (reducedMotion()) return;
  const now = Date.now();
  if (now - lastFiredAt < 180) return;
  lastFiredAt = now;
  const haptics = getInstance();
  if (!haptics) return;
  // 35ms·intensity 1.0 → PWM 없이 35ms 연속 펄스 → 명확한 "툭" 탭.
  // iOS 17.4+ 의 <input switch> 햅틱은 trigger() 가 동기적으로 .click() 을 발화하므로
  // 호출 자체를 scroll 이벤트 핸들러(user gesture context) 안에서 해야 작동.
  void haptics.trigger([{ duration: 35, intensity: 1.0 }]);
}
