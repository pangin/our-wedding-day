import { describe, expect, it } from 'vitest';
import {
  buildGoogleCalendarUrl,
  getKstDateKey,
  validateGuestbookMessage,
} from './commentPolicy';

describe('validateGuestbookMessage', () => {
  it('accepts a normal short blessing', () => {
    expect(validateGuestbookMessage('두 분 결혼 축하드려요!')).toMatchObject({
      ok: true,
      normalizedMessage: '두 분 결혼 축하드려요!',
    });
  });

  it('rejects more than one url', () => {
    expect(validateGuestbookMessage('https://a.test www.b.test')).toEqual({
      ok: false,
      reason: '링크는 1개까지만 포함할 수 있습니다.',
    });
  });

  it('uses Asia/Seoul as the daily edit boundary', () => {
    expect(getKstDateKey(new Date('2026-05-10T15:10:00.000Z'))).toBe('2026-05-11');
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('builds a Google Calendar template url', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Wedding',
      start: '2026-10-17T13:30:00+09:00',
      end: '2026-10-17T15:30:00+09:00',
      location: 'Seoul',
      details: 'Invitation',
    });

    expect(url).toContain('calendar.google.com');
    expect(url).toContain('Wedding');
  });
});
