import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';

type NaverProfile = {
  resultcode: string;
  message: string;
  response?: {
    id: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
};

type NaverTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'POST 요청만 지원합니다.' }, 405);
    }

    const env = getEnv();
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '').trim();
    const state = String(body.state ?? '').trim();

    if (!code || !state) {
      return json({ error: '네이버 인증 정보가 부족합니다.' }, 400);
    }

    const tokenResponse = await fetch(NAVER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.naverClientId,
        client_secret: env.naverClientSecret,
        code,
        state,
      }).toString(),
    });

    const tokenData = (await tokenResponse.json()) as NaverTokenResponse;
    if (!tokenData.access_token) {
      return json(
        {
          error: `네이버 토큰 교환 실패: ${tokenData.error_description ?? tokenData.error ?? '알 수 없는 오류'}`,
        },
        401,
      );
    }

    const profileResponse = await fetch(NAVER_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = (await profileResponse.json()) as NaverProfile;
    if (profileData.resultcode !== '00' || !profileData.response) {
      return json({ error: '네이버 프로필을 가져오지 못했습니다.' }, 502);
    }

    const { id: naverId, email, name, nickname } = profileData.response;
    if (!email) {
      return json(
        { error: '네이버 이메일 정보가 필요합니다. 동의 화면에서 이메일 제공에 동의해 주세요.' },
        400,
      );
    }

    const displayName = name?.trim() || nickname?.trim() || email.split('@')[0];

    const db = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: createError } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        name: displayName,
        provider: 'naver',
        naver_id: naverId,
      },
    });

    if (createError && !isEmailExistsError(createError)) {
      return json({ error: `사용자 생성 실패: ${createError.message}` }, 500);
    }

    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      return json(
        { error: linkError?.message ?? '세션 토큰 발급에 실패했습니다.' },
        500,
      );
    }

    return json({
      tokenHash: linkData.properties.hashed_token,
      email,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' },
      500,
    );
  }
});

function isEmailExistsError(error: { message?: string; code?: string; status?: number }): boolean {
  if (error?.code === 'email_exists') return true;
  if (error?.status === 422) return true;
  const message = (error?.message ?? '').toLowerCase();
  return message.includes('already') || message.includes('exists') || message.includes('registered');
}

function getEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const naverClientId = Deno.env.get('NAVER_CLIENT_ID');
  const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !naverClientId || !naverClientSecret) {
    throw new Error('Supabase 또는 네이버 환경 변수가 누락되었습니다.');
  }

  return { supabaseUrl, serviceRoleKey, naverClientId, naverClientSecret };
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
