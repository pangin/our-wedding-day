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
  if (now - lastFiredAt < 200) return;
  lastFiredAt = now;
  const haptics = getInstance();
  if (!haptics) return;
  void haptics.trigger([{ duration: 12, intensity: 0.65 }]);
}
