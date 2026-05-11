import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CommentStatus = 'approved' | 'pending' | 'rejected' | 'hidden';

const allowedStatuses = new Set<CommentStatus>(['approved', 'pending', 'rejected', 'hidden']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { data: isAdmin, error: adminError } = await db.rpc('is_guestbook_admin', {
      p_user_id: user.id,
      p_email: user.email ?? '',
    });

    if (adminError || !isAdmin) {
      return json({ error: '관리자 권한이 필요합니다.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'list');

    if (action === 'list') {
      const { data, error } = await db
        .from('guestbook_comments')
        .select('id,user_id,display_name,message,status,created_at,updated_at,approved_at,rejection_reason')
        .order('updated_at', { ascending: false });

      if (error) {
        return json({ error: error.message }, 500);
      }

      return json({ comments: data ?? [] });
    }

    if (action === 'set-status') {
      const commentId = String(body.commentId ?? '');
      const status = String(body.status ?? '') as CommentStatus;

      if (!commentId || !allowedStatuses.has(status)) {
        return json({ error: '잘못된 상태 변경 요청입니다.' }, 400);
      }

      const now = new Date().toISOString();
      const { error } = await db
        .from('guestbook_comments')
        .update({
          status,
          approved_at: status === 'approved' ? now : null,
          hidden_at: status === 'hidden' ? now : null,
          updated_at: now,
        })
        .eq('id', commentId);

      if (error) {
        return json({ error: error.message }, 500);
      }

      return json({ ok: true });
    }

    if (action === 'delete') {
      const commentId = String(body.commentId ?? '');

      if (!commentId) {
        return json({ error: '삭제할 댓글이 없습니다.' }, 400);
      }

      const { error } = await db.from('guestbook_comments').delete().eq('id', commentId);
      if (error) {
        return json({ error: error.message }, 500);
      }

      return json({ ok: true });
    }

    return json({ error: '지원하지 않는 관리자 작업입니다.' }, 400);
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

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
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
