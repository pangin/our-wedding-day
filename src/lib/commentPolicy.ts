export type CommentStatus = 'approved' | 'pending' | 'rejected' | 'hidden';

export type ValidationResult =
  | { ok: true; normalizedMessage: string; urlCount: number }
  | { ok: false; reason: string };

const URL_PATTERN = /(https?:\/\/|www\.)/gi;
const SPAMMY_PATTERN = /(바카라|카지노|대출|성인|무료\s*충전|토토|비아그라)/i;

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function validateGuestbookMessage(message: string): ValidationResult {
  const normalizedMessage = normalizeWhitespace(message);
  const length = Array.from(normalizedMessage).length;

  if (length < 2) {
    return { ok: false, reason: '댓글은 2자 이상 입력해 주세요.' };
  }

  if (length > 500) {
    return { ok: false, reason: '댓글은 500자 이하로 입력해 주세요.' };
  }

  const urlCount = normalizedMessage.match(URL_PATTERN)?.length ?? 0;
  if (urlCount > 1) {
    return { ok: false, reason: '링크는 1개까지만 포함할 수 있습니다.' };
  }

  if (SPAMMY_PATTERN.test(normalizedMessage)) {
    return { ok: false, reason: '스팸으로 의심되는 표현이 포함되어 있습니다.' };
  }

  return { ok: true, normalizedMessage, urlCount };
}

export function getKstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function buildGoogleCalendarUrl(input: {
  title: string;
  start: string;
  end: string;
  location: string;
  details: string;
}) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${formatGoogleCalendarDate(input.start)}/${formatGoogleCalendarDate(input.end)}`,
    location: input.location,
    details: input.details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatGoogleCalendarDate(isoDate: string) {
  return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
