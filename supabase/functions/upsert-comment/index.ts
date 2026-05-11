import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CommentStatus = 'approved' | 'pending' | 'rejected' | 'hidden';

type ModerationResult = {
  status: CommentStatus;
  score: number | null;
  reason: string | null;
  payload: Record<string, unknown>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const urlPattern = /(https?:\/\/|www\.)/gi;
const spammyPattern = /(바카라|카지노|대출|성인|무료\s*충전|토토|비아그라)/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'POST 요청만 지원합니다.' }, 405);
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

    const turnstile = await verifyTurnstile(
      validation.turnstileToken,
      env.turnstileSecretKey,
      req.headers.get('CF-Connecting-IP') ?? undefined,
    );
    if (!turnstile.ok) {
      return json({ error: turnstile.reason }, 403);
    }

    const moderation =
      validation.urlCount > 1
        ? {
            status: 'rejected' as const,
            score: 1,
            reason: 'too_many_links',
            payload: { localRule: 'too_many_links' },
          }
        : await moderateComment(validation.message, env.googleCloudNlApiKey);

    const { data: comment, error: upsertError } = await db.rpc('upsert_guestbook_comment', {
      p_user_id: user.id,
      p_display_name: validation.displayName,
      p_message: validation.message,
      p_status: moderation.status,
      p_moderation_score: moderation.score,
      p_moderation_payload: moderation.payload,
      p_rejection_reason: moderation.reason,
      p_event_date: getKstDateKey(),
    });

    if (upsertError) {
      if (upsertError.message.includes('edit_limit_exceeded')) {
        return json({ error: '댓글 수정은 하루에 한 번만 가능합니다.' }, 429);
      }
      return json({ error: upsertError.message }, 500);
    }

    return json({ comment });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' }, 500);
  }
});

function getEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Supabase Edge Function 환경 변수가 누락되었습니다.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    turnstileSecretKey: Deno.env.get('TURNSTILE_SECRET_KEY') ?? '',
    googleCloudNlApiKey: Deno.env.get('GOOGLE_CLOUD_NL_API_KEY') ?? '',
  };
}

function validatePayload(body: Record<string, unknown>) {
  const message = normalizeWhitespace(String(body.message ?? ''));
  const displayName = normalizeWhitespace(String(body.displayName ?? '하객')).slice(0, 80);
  const turnstileToken = String(body.turnstileToken ?? '');
  const length = Array.from(message).length;

  if (length < 2) {
    return { ok: false as const, reason: '댓글은 2자 이상 입력해 주세요.' };
  }

  if (length > 500) {
    return { ok: false as const, reason: '댓글은 500자 이하로 입력해 주세요.' };
  }

  if (spammyPattern.test(message)) {
    return { ok: false as const, reason: '스팸으로 의심되는 표현이 포함되어 있습니다.' };
  }

  return {
    ok: true as const,
    message,
    displayName: displayName || '하객',
    turnstileToken,
    urlCount: message.match(urlPattern)?.length ?? 0,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

async function verifyTurnstile(token: string, secret: string, remoteIp?: string) {
  if (!secret && Deno.env.get('SKIP_TURNSTILE_FOR_LOCAL_DEV') === 'true') {
    return { ok: true as const };
  }

  if (!secret) {
    return { ok: false as const, reason: 'Turnstile secret이 설정되지 않았습니다.' };
  }

  if (!token) {
    return { ok: false as const, reason: '스팸 방지 확인이 필요합니다.' };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();

  if (!result.success) {
    return { ok: false as const, reason: '스팸 방지 확인에 실패했습니다.' };
  }

  return { ok: true as const };
}

async function moderateComment(message: string, apiKey: string): Promise<ModerationResult> {
  if (!apiKey) {
    return {
      status: 'pending',
      score: null,
      reason: 'moderation_api_not_configured',
      payload: {},
    };
  }

  try {
    const response = await fetch(
      `https://language.googleapis.com/v2/documents:moderateText?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            type: 'PLAIN_TEXT',
            content: message,
            languageCode: 'ko',
          },
          modelVersion: 'MODEL_VERSION_2',
        }),
      },
    );

    if (!response.ok) {
      return {
        status: 'pending',
        score: null,
        reason: 'moderation_api_failed',
        payload: { status: response.status, body: await response.text() },
      };
    }

    const payload = await response.json();
    const scores = Array.isArray(payload.moderationCategories)
      ? payload.moderationCategories.map((category: { confidence?: number; severity?: number }) =>
          Math.max(category.confidence ?? 0, category.severity ?? 0),
        )
      : [];
    const maxScore = scores.length ? Math.max(...scores) : 0;

    if (maxScore >= 0.86) {
      return { status: 'rejected', score: maxScore, reason: 'moderation_rejected', payload };
    }

    if (maxScore >= 0.58) {
      return { status: 'pending', score: maxScore, reason: 'moderation_review', payload };
    }

    return { status: 'approved', score: maxScore, reason: null, payload };
  } catch (error) {
    return {
      status: 'pending',
      score: null,
      reason: 'moderation_api_error',
      payload: { message: error instanceof Error ? error.message : 'unknown' },
    };
  }
}

function getKstDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
