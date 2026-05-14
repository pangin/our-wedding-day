import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RsvpSide = 'groom' | 'bride';
type RsvpMeal = 'yes' | 'no' | 'na';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RSVP_DEADLINE_MS = Date.parse('2026-06-26T14:59:59Z');
const NAME_LIMIT = 20;
const CONTACT_LIMIT = 30;
const MESSAGE_LIMIT = 200;
const PARTY_MAX = 8;
const CONTACT_FORMAT = /^[0-9+\-\s().]*$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'POST 요청만 지원합니다.' }, 405);
    }

    if (Date.now() > RSVP_DEADLINE_MS) {
      return json({ error: 'RSVP 응답이 마감되었습니다.' }, 410);
    }

    const env = getEnv();
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: '로그인이 필요합니다.' }, 401);
    }

    const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const db = createClient(env.supabaseUrl, env.serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return json({ error: '로그인이 필요합니다.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const validation = validatePayload(body);
    if (!validation.ok) {
      return json({ error: validation.reason }, 400);
    }

    const { data: rsvp, error: rpcError } = await db.rpc('upsert_rsvp_response', {
      p_user_id: user.id,
      p_display_name: validation.displayName,
      p_attending: validation.attending,
      p_side: validation.side,
      p_party_size: validation.partySize,
      p_meal: validation.meal,
      p_contact: validation.contact,
      p_message: validation.message,
    });

    if (rpcError) {
      return json({ error: rpcError.message }, 500);
    }

    return json({ rsvp });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' },
      500,
    );
  }
});

function getEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Supabase Edge Function 환경 변수가 누락되었습니다.');
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

type ValidationOk = {
  ok: true;
  displayName: string;
  attending: boolean;
  side: RsvpSide;
  partySize: number;
  meal: RsvpMeal;
  contact: string | null;
  message: string | null;
};
type ValidationFail = { ok: false; reason: string };

function validatePayload(body: Record<string, unknown>): ValidationOk | ValidationFail {
  const displayName = String(body.displayName ?? '').trim();
  if (displayName.length < 1 || Array.from(displayName).length > NAME_LIMIT) {
    return { ok: false, reason: `성함은 1~${NAME_LIMIT}자로 입력해 주세요.` };
  }

  if (typeof body.attending !== 'boolean') {
    return { ok: false, reason: '참석 여부를 선택해 주세요.' };
  }
  const attending = body.attending;

  if (body.side !== 'groom' && body.side !== 'bride') {
    return { ok: false, reason: '신랑측/신부측을 선택해 주세요.' };
  }
  const side = body.side as RsvpSide;

  let partySize = 1;
  let meal: RsvpMeal = 'na';

  if (attending) {
    const size = Number(body.partySize);
    if (!Number.isInteger(size) || size < 1 || size > PARTY_MAX) {
      return { ok: false, reason: `동행 인원은 1~${PARTY_MAX}명 사이로 골라 주세요.` };
    }
    partySize = size;

    if (body.meal !== 'yes' && body.meal !== 'no') {
      return { ok: false, reason: '식사 여부를 선택해 주세요.' };
    }
    meal = body.meal;
  }

  const contactRaw = String(body.contact ?? '').trim();
  let contact: string | null = null;
  if (contactRaw.length > 0) {
    if (Array.from(contactRaw).length > CONTACT_LIMIT) {
      return { ok: false, reason: `연락처는 ${CONTACT_LIMIT}자 이하로 입력해 주세요.` };
    }
    if (!CONTACT_FORMAT.test(contactRaw)) {
      return { ok: false, reason: '연락처 형식이 올바르지 않습니다.' };
    }
    contact = contactRaw;
  }

  const messageRaw = String(body.message ?? '').trim();
  let message: string | null = null;
  if (messageRaw.length > 0) {
    if (Array.from(messageRaw).length > MESSAGE_LIMIT) {
      return { ok: false, reason: `RSVP 메시지는 ${MESSAGE_LIMIT}자 이하로 입력해 주세요.` };
    }
    message = messageRaw;
  }

  return { ok: true, displayName, attending, side, partySize, meal, contact, message };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
