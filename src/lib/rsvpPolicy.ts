export const RSVP_DEADLINE_UTC = new Date('2026-06-26T14:59:59Z');

const FORCE_CLOSED = import.meta.env.VITE_RSVP_CLOSED === 'true';

export const RSVP_LIMITS = {
  name: 20,
  contact: 30,
  message: 200,
  partyMax: 8,
} as const;

export type RsvpSide = 'groom' | 'bride';
export type RsvpMeal = 'yes' | 'no' | 'na';

export type RsvpFormInput = {
  displayName: string;
  attending: boolean;
  side: RsvpSide;
  partySize: number;
  meal: RsvpMeal;
  contact?: string | null;
  message?: string | null;
};

export type RsvpValidation =
  | { ok: true; normalized: RsvpFormInput }
  | { ok: false; reason: string };

const CONTACT_FORMAT = /^[0-9+\-\s().]*$/;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateRsvpPayload(input: unknown): RsvpValidation {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: '응답을 다시 확인해 주세요.' };
  }

  const raw = input as Record<string, unknown>;

  const displayName = asTrimmedString(raw.displayName);
  if (displayName.length < 1 || Array.from(displayName).length > RSVP_LIMITS.name) {
    return { ok: false, reason: `성함은 1~${RSVP_LIMITS.name}자로 입력해 주세요.` };
  }

  if (typeof raw.attending !== 'boolean') {
    return { ok: false, reason: '참석 여부를 선택해 주세요.' };
  }
  const attending = raw.attending;

  if (raw.side !== 'groom' && raw.side !== 'bride') {
    return { ok: false, reason: '신랑측/신부측을 선택해 주세요.' };
  }
  const side: RsvpSide = raw.side;

  let partySize = 1;
  let meal: RsvpMeal = 'na';

  if (attending) {
    const size = Number(raw.partySize);
    if (!Number.isInteger(size) || size < 1 || size > RSVP_LIMITS.partyMax) {
      return { ok: false, reason: `동행 인원은 1~${RSVP_LIMITS.partyMax}명 사이로 골라 주세요.` };
    }
    partySize = size;

    if (raw.meal !== 'yes' && raw.meal !== 'no') {
      return { ok: false, reason: '식사 여부를 선택해 주세요.' };
    }
    meal = raw.meal;
  }

  const contactRaw = asTrimmedString(raw.contact);
  let contact: string | null = null;
  if (contactRaw.length > 0) {
    if (Array.from(contactRaw).length > RSVP_LIMITS.contact) {
      return { ok: false, reason: `연락처는 ${RSVP_LIMITS.contact}자 이하로 입력해 주세요.` };
    }
    if (!CONTACT_FORMAT.test(contactRaw)) {
      return { ok: false, reason: '연락처는 숫자와 +, -, 공백, 괄호만 사용할 수 있어요.' };
    }
    contact = contactRaw;
  }

  const messageRaw = asTrimmedString(raw.message);
  let message: string | null = null;
  if (messageRaw.length > 0) {
    if (Array.from(messageRaw).length > RSVP_LIMITS.message) {
      return { ok: false, reason: `RSVP 메시지는 ${RSVP_LIMITS.message}자 이하로 입력해 주세요.` };
    }
    message = messageRaw;
  }

  return {
    ok: true,
    normalized: {
      displayName,
      attending,
      side,
      partySize,
      meal,
      contact,
      message,
    },
  };
}

export function isRsvpClosed(now: number = Date.now()): boolean {
  return FORCE_CLOSED || now > RSVP_DEADLINE_UTC.getTime();
}

export function rsvpDaysLeft(now: number = Date.now()): number {
  if (FORCE_CLOSED) return 0;
  const diff = RSVP_DEADLINE_UTC.getTime() - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

export function rsvpDeadlineLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(RSVP_DEADLINE_UTC);
}
