import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Edit3, LogIn, LogOut, Send, Sparkles } from 'lucide-react';
import { TurnstileWidget } from './TurnstileWidget';
import { validateGuestbookMessage } from '../lib/commentPolicy';
import { isSupabaseConfigured, supabase, type GuestbookComment } from '../lib/supabase';

type UpsertResponse = {
  comment?: GuestbookComment;
  error?: string;
};

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export function Guestbook() {
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<GuestbookComment[]>([]);
  const [myComment, setMyComment] = useState<GuestbookComment | null>(null);
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayName = useMemo(() => {
    const user = session?.user;
    return (
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      '하객'
    );
  }, [session]);

  const loadComments = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const { data } = await supabase
      .from('guestbook_comments')
      .select('id,user_id,display_name,message,status,created_at,updated_at,approved_at,rejection_reason')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });

    setComments((data ?? []) as GuestbookComment[]);
  }, []);

  const loadMyComment = useCallback(async (currentSession: Session | null) => {
    if (!currentSession || !supabase) {
      setMyComment(null);
      setMessage('');
      return;
    }

    const { data } = await supabase
      .from('guestbook_comments')
      .select('id,user_id,display_name,message,status,created_at,updated_at,approved_at,rejection_reason')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    const existing = (data ?? null) as GuestbookComment | null;
    setMyComment(existing);
    setMessage(existing?.message ?? '');
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadMyComment(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadMyComment(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadMyComment]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function signIn(provider: 'kakao' | 'google') {
    if (!supabase) {
      setStatusMessage('Supabase 환경 변수가 필요합니다.');
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href.split('#')[0] + '#guestbook',
      },
    });
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session) {
      setStatusMessage('로그인 후 남겨 주세요.');
      return;
    }

    const validation = validateGuestbookMessage(message);
    if (!validation.ok) {
      setStatusMessage(validation.reason);
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setStatusMessage('스팸 방지 확인을 완료해 주세요.');
      return;
    }

    setSubmitting(true);
    setStatusMessage('');

    const { data, error } = await supabase.functions.invoke<UpsertResponse>('upsert-comment', {
      body: {
        message: validation.normalizedMessage,
        displayName,
        turnstileToken,
      },
    });

    setSubmitting(false);
    window.turnstile?.reset();
    setTurnstileToken('');

    if (error || data?.error) {
      setStatusMessage(data?.error ?? error?.message ?? '방명록 저장에 실패했습니다.');
      return;
    }

    setMyComment(data?.comment ?? null);
    setStatusMessage(
      data?.comment?.status === 'approved'
        ? '따뜻한 마음이 방명록에 올라갔습니다.'
        : '댓글을 검수 중입니다. 확인 후 공개됩니다.',
    );
    await loadComments();
  }

  return (
    <section className="section section--guestbook" id="guestbook">
      <div className="section__inner guestbook-grid">
        <div className="section-copy">
          <p className="eyebrow">Guestbook</p>
          <h2>마음을 남겨 주세요</h2>
          <p>
            로그인한 계정당 하나의 축하 메시지를 남길 수 있습니다. 작성 후에는 하루 한 번만
            수정할 수 있어요.
          </p>
        </div>

        <div className="guestbook-panel">
          {!isSupabaseConfigured ? (
            <div className="notice-box">
              <Sparkles size={18} aria-hidden="true" />
              <p>Supabase 환경 변수를 설정하면 방명록이 활성화됩니다.</p>
            </div>
          ) : session ? (
            <form className="guestbook-form" onSubmit={submitComment}>
              <div className="guestbook-form__head">
                <span>{displayName}님</span>
                <button className="text-button" type="button" onClick={signOut}>
                  <LogOut size={16} aria-hidden="true" />
                  로그아웃
                </button>
              </div>
              <label htmlFor="guestbook-message">
                {myComment ? '내 축하 메시지' : '축하 메시지'}
              </label>
              <textarea
                id="guestbook-message"
                value={message}
                maxLength={500}
                rows={5}
                onChange={(event) => setMessage(event.target.value)}
              />
              <div className="guestbook-form__meta">
                <span>{Array.from(message).length}/500</span>
                {myComment ? (
                  <span className={`status-pill status-pill--${myComment.status}`}>
                    {myComment.status === 'approved' ? '공개됨' : '검수 중'}
                  </span>
                ) : null}
              </div>
              {turnstileSiteKey ? (
                <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
              ) : null}
              <button className="button button--wide" type="submit" disabled={submitting}>
                {myComment ? <Edit3 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                {myComment ? '하루 한 번 수정하기' : '축하 메시지 남기기'}
              </button>
              {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
            </form>
          ) : (
            <div className="login-box">
              <p>로그인 후 방명록을 남길 수 있습니다.</p>
              <div className="login-box__actions">
                <button className="button" type="button" onClick={() => signIn('kakao')}>
                  <LogIn size={17} aria-hidden="true" />
                  Kakao
                </button>
                <button className="button button--ghost" type="button" onClick={() => signIn('google')}>
                  <LogIn size={17} aria-hidden="true" />
                  Google
                </button>
              </div>
              {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
            </div>
          )}
        </div>

        <div className="comments-list" aria-live="polite">
          {comments.length ? (
            comments.map((comment) => (
              <article className="comment-card" key={comment.id}>
                <div>
                  <strong>{comment.display_name}</strong>
                  <time dateTime={comment.approved_at ?? comment.created_at}>
                    {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(
                      new Date(comment.approved_at ?? comment.created_at),
                    )}
                  </time>
                </div>
                <p>{comment.message}</p>
              </article>
            ))
          ) : (
            <p className="empty-comments">첫 축하 메시지를 기다리고 있습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
