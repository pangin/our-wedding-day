import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Edit3, LogIn, LogOut, Send, Sparkles } from 'lucide-react';
import { TurnstileWidget } from './TurnstileWidget';
import { validateGuestbookMessage } from '../lib/commentPolicy';
import { consumeKakaoCallback, redirectToKakaoLogin } from '../lib/kakao';
import { consumeNaverCallback, redirectToNaverLogin } from '../lib/naver';
import {
  isSupabaseConfigured,
  supabase,
  type GuestbookComment,
  type RsvpResponse,
} from '../lib/supabase';
import {
  isRsvpClosed,
  RSVP_LIMITS,
  rsvpDaysLeft,
  validateRsvpPayload,
  type RsvpMeal,
  type RsvpSide,
} from '../lib/rsvpPolicy';
import { wedding } from '../content/wedding';

type UpsertCommentResponse = {
  comment?: GuestbookComment;
  error?: string;
};

type UpsertRsvpResponse = {
  rsvp?: RsvpResponse;
  error?: string;
};

type GuestbookProps = {
  onNotice: (message: string) => void;
};

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const PARTY_OPTIONS = Array.from({ length: RSVP_LIMITS.partyMax }, (_, i) => i + 1);

export function Guestbook({ onNotice }: GuestbookProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<GuestbookComment[]>([]);
  const [myComment, setMyComment] = useState<GuestbookComment | null>(null);
  const [myRsvp, setMyRsvp] = useState<RsvpResponse | null>(null);
  const [message, setMessage] = useState('');
  const [rsvpName, setRsvpName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [side, setSide] = useState<RsvpSide | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [meal, setMeal] = useState<RsvpMeal>('yes');
  const [contact, setContact] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const closed = isRsvpClosed(now);
  const daysLeft = rsvpDaysLeft(now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const loadComments = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data } = await supabase
      .from('guestbook_comments')
      .select('id,user_id,display_name,message,status,created_at,updated_at,approved_at,rejection_reason')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });

    setComments((data ?? []) as GuestbookComment[]);
  }, []);

  const loadMyData = useCallback(async (currentSession: Session | null) => {
    if (!currentSession || !supabase) {
      setMyComment(null);
      setMyRsvp(null);
      setMessage('');
      setRsvpName('');
      setAttending(null);
      setSide(null);
      setPartySize(1);
      setMeal('yes');
      setContact('');
      return;
    }

    const [commentRes, rsvpRes] = await Promise.all([
      supabase
        .from('guestbook_comments')
        .select('id,user_id,display_name,message,status,created_at,updated_at,approved_at,rejection_reason')
        .eq('user_id', currentSession.user.id)
        .maybeSingle(),
      supabase
        .from('rsvp_responses')
        .select(
          'id,user_id,display_name,attending,side,party_size,meal,contact,message,created_at,updated_at',
        )
        .eq('user_id', currentSession.user.id)
        .maybeSingle(),
    ]);

    const existingComment = (commentRes.data ?? null) as GuestbookComment | null;
    const existingRsvp = (rsvpRes.data ?? null) as RsvpResponse | null;

    setMyComment(existingComment);
    setMyRsvp(existingRsvp);
    setMessage(existingComment?.message ?? '');

    if (existingRsvp) {
      setRsvpName(existingRsvp.display_name);
      setAttending(existingRsvp.attending);
      setSide(existingRsvp.side);
      setPartySize(existingRsvp.party_size);
      setMeal(existingRsvp.meal === 'na' ? 'yes' : existingRsvp.meal);
      setContact(existingRsvp.contact ?? '');
    } else {
      const fallbackName =
        currentSession.user.user_metadata?.full_name ||
        currentSession.user.user_metadata?.name ||
        '';
      setRsvpName(fallbackName);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    void (async () => {
      try {
        const callback = await consumeKakaoCallback();
        if (callback && supabase) {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'kakao',
            token: callback.idToken,
            nonce: callback.nonce,
          });
          if (error && !cancelled) {
            setStatusMessage(`카카오 로그인 실패: ${error.message}`);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '알 수 없는 오류';
          setStatusMessage(`카카오 로그인 실패: ${msg}`);
        }
      }

      try {
        const naverCallback = consumeNaverCallback();
        if (naverCallback && supabase) {
          const { data, error } = await supabase.functions.invoke<{
            tokenHash?: string;
            email?: string;
            error?: string;
          }>('naver-auth', { body: naverCallback });

          if (error || data?.error) {
            if (!cancelled) {
              setStatusMessage(`네이버 로그인 실패: ${data?.error ?? error?.message}`);
            }
          } else if (data?.tokenHash) {
            const { error: otpError } = await supabase.auth.verifyOtp({
              token_hash: data.tokenHash,
              type: 'magiclink',
            });
            if (otpError && !cancelled) {
              setStatusMessage(`네이버 로그인 실패: ${otpError.message}`);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '알 수 없는 오류';
          setStatusMessage(`네이버 로그인 실패: ${msg}`);
        }
      }

      if (cancelled || !supabase) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      void loadMyData(data.session);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadMyData(nextSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadMyData]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (session && sessionStorage.getItem('postLoginScrollTo') === 'guestbook') {
      sessionStorage.removeItem('postLoginScrollTo');
      if (window.location.hash !== '#guestbook') {
        window.location.hash = '#guestbook';
      }
    }
  }, [session]);

  async function signIn(provider: 'kakao' | 'google' | 'naver') {
    if (!supabase) {
      setStatusMessage('Supabase 환경 변수가 필요합니다.');
      return;
    }

    sessionStorage.setItem('postLoginScrollTo', 'guestbook');

    if (provider === 'kakao') {
      try {
        await redirectToKakaoLogin();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        setStatusMessage(`카카오 로그인 실패: ${msg}`);
      }
      return;
    }

    if (provider === 'naver') {
      try {
        redirectToNaverLogin();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        setStatusMessage(`네이버 로그인 실패: ${msg}`);
      }
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href.split('#')[0],
      },
    });
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session) {
      setStatusMessage('로그인 후 응답을 남겨 주세요.');
      return;
    }

    if (closed) {
      setStatusMessage('RSVP 응답이 마감되었습니다.');
      return;
    }

    const rsvpValidation = validateRsvpPayload({
      displayName: rsvpName,
      attending,
      side,
      partySize,
      meal,
      contact,
    });
    if (!rsvpValidation.ok) {
      setStatusMessage(rsvpValidation.reason);
      return;
    }

    const trimmedMessage = message.trim();
    const hasMessage = trimmedMessage.length > 0;
    const previousMessage = myComment?.message ?? '';
    const messageChanged = trimmedMessage !== previousMessage;
    const shouldSubmitComment = hasMessage && messageChanged;

    if (shouldSubmitComment) {
      const messageValidation = validateGuestbookMessage(trimmedMessage);
      if (!messageValidation.ok) {
        setStatusMessage(messageValidation.reason);
        return;
      }
      if (turnstileSiteKey && !turnstileToken) {
        setStatusMessage('스팸 방지 확인을 완료해 주세요.');
        return;
      }
    }

    setSubmitting(true);
    setStatusMessage('');

    const rsvpBody = {
      displayName: rsvpValidation.normalized.displayName,
      attending: rsvpValidation.normalized.attending,
      side: rsvpValidation.normalized.side,
      partySize: rsvpValidation.normalized.partySize,
      meal: rsvpValidation.normalized.meal,
      contact: rsvpValidation.normalized.contact,
      message: rsvpValidation.normalized.message,
    };

    const [rsvpInvoke, commentInvoke] = await Promise.all([
      supabase.functions.invoke<UpsertRsvpResponse>('upsert-rsvp', { body: rsvpBody }),
      shouldSubmitComment
        ? supabase.functions.invoke<UpsertCommentResponse>('upsert-comment', {
            body: {
              message: trimmedMessage,
              displayName: rsvpValidation.normalized.displayName,
              turnstileToken,
            },
          })
        : Promise.resolve(null),
    ]);

    setSubmitting(false);
    window.turnstile?.reset();
    setTurnstileToken('');

    const rsvpErr = rsvpInvoke.data?.error ?? rsvpInvoke.error?.message;
    if (rsvpErr) {
      setStatusMessage(rsvpErr);
      return;
    }
    if (rsvpInvoke.data?.rsvp) {
      setMyRsvp(rsvpInvoke.data.rsvp);
    }

    if (commentInvoke) {
      const commentErr = commentInvoke.data?.error ?? commentInvoke.error?.message;
      if (commentErr) {
        onNotice('참석 응답은 저장됐지만 축하 메시지 저장에 실패했어요.');
        setStatusMessage(commentErr);
        return;
      }
      setMyComment(commentInvoke.data?.comment ?? null);
      onNotice(
        commentInvoke.data?.comment?.status === 'approved'
          ? '참석 응답과 축하 메시지가 저장되었습니다.'
          : '참석 응답이 저장되었어요. 축하 메시지는 검수 후 공개됩니다.',
      );
      await loadComments();
    } else {
      onNotice(myRsvp ? '참석 응답이 수정되었습니다.' : '참석 응답이 저장되었습니다.');
    }
  }

  const mealLabel: Record<RsvpMeal, string> = { yes: '식사함', no: '식사 안 함', na: '해당 없음' };
  const sideLabel: Record<RsvpSide, string> = { groom: '신랑측', bride: '신부측' };

  return (
    <section className="section section--guestbook" id="guestbook">
      <div className="section__inner guestbook-grid">
        <div className="section-copy">
          <p className="eyebrow">Guestbook & RSVP</p>
          <h2>{wedding.copy.guestbookHeading}</h2>
          <p>{wedding.copy.guestbookSubcopy}</p>
          {!closed ? (
            <p className="rsvp-deadline">
              {wedding.copy.rsvpDeadlineNotice}
              {daysLeft > 0 && daysLeft <= 14 ? (
                <span className={`rsvp-deadline-pill${daysLeft <= 1 ? ' rsvp-deadline-pill--urgent' : ''}`}>
                  {daysLeft === 1 ? '오늘 자정 마감' : `D-${daysLeft}`}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="guestbook-panel">
          {!isSupabaseConfigured ? (
            <div className="notice-box">
              <Sparkles size={18} aria-hidden="true" />
              <p>Supabase 환경 변수를 설정하면 응답이 활성화됩니다.</p>
            </div>
          ) : !session ? (
            <div className="login-box">
              <p>로그인 후 참석 여부와 축하 메시지를 남길 수 있습니다.</p>
              <div className="login-box__actions">
                <button className="button" type="button" onClick={() => signIn('kakao')}>
                  <LogIn size={17} aria-hidden="true" />
                  Kakao
                </button>
                <button className="button button--ghost" type="button" onClick={() => signIn('naver')}>
                  <LogIn size={17} aria-hidden="true" />
                  Naver
                </button>
                <button className="button button--ghost" type="button" onClick={() => signIn('google')}>
                  <LogIn size={17} aria-hidden="true" />
                  Google
                </button>
              </div>
              {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
            </div>
          ) : closed ? (
            <div className="guestbook-form">
              <div className="guestbook-form__head">
                <span>{rsvpName || '하객'}님</span>
                <button className="text-button" type="button" onClick={signOut}>
                  <LogOut size={16} aria-hidden="true" />
                  로그아웃
                </button>
              </div>
              {myRsvp ? (
                <div className="rsvp-summary-card" aria-label="내 응답 요약">
                  <p className="eyebrow">내 응답</p>
                  <dl>
                    <div>
                      <dt>성함</dt>
                      <dd>{myRsvp.display_name}</dd>
                    </div>
                    <div>
                      <dt>참석</dt>
                      <dd>{myRsvp.attending ? '참석' : '불참'}</dd>
                    </div>
                    <div>
                      <dt>측</dt>
                      <dd>{sideLabel[myRsvp.side]}</dd>
                    </div>
                    {myRsvp.attending ? (
                      <>
                        <div>
                          <dt>인원</dt>
                          <dd>{myRsvp.party_size}명</dd>
                        </div>
                        <div>
                          <dt>식사</dt>
                          <dd>{mealLabel[myRsvp.meal]}</dd>
                        </div>
                      </>
                    ) : null}
                    {myRsvp.contact ? (
                      <div>
                        <dt>연락처</dt>
                        <dd>{myRsvp.contact}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : (
                <div className="notice-box">
                  <Sparkles size={18} aria-hidden="true" />
                  <p>{wedding.copy.rsvpClosedNotice}</p>
                </div>
              )}
            </div>
          ) : (
            <form className="guestbook-form" onSubmit={handleSubmit}>
              <div className="guestbook-form__head">
                <span>{rsvpName || '하객'}님</span>
                <button className="text-button" type="button" onClick={signOut}>
                  <LogOut size={16} aria-hidden="true" />
                  로그아웃
                </button>
              </div>

              <div className="rsvp-field">
                <label htmlFor="rsvp-name">성함</label>
                <input
                  id="rsvp-name"
                  type="text"
                  value={rsvpName}
                  maxLength={RSVP_LIMITS.name}
                  onChange={(event) => setRsvpName(event.target.value)}
                  placeholder="예: 홍길동"
                  autoComplete="name"
                  required
                />
              </div>

              <fieldset className="rsvp-field rsvp-field--radio">
                <legend>참석 여부</legend>
                <div className="rsvp-radio-group">
                  <label className={`rsvp-radio${attending === true ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="attending"
                      checked={attending === true}
                      onChange={() => setAttending(true)}
                    />
                    <span>참석</span>
                  </label>
                  <label className={`rsvp-radio${attending === false ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="attending"
                      checked={attending === false}
                      onChange={() => setAttending(false)}
                    />
                    <span>불참</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="rsvp-field rsvp-field--radio">
                <legend>측</legend>
                <div className="rsvp-radio-group">
                  <label className={`rsvp-radio${side === 'groom' ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="side"
                      checked={side === 'groom'}
                      onChange={() => setSide('groom')}
                    />
                    <span>신랑측</span>
                  </label>
                  <label className={`rsvp-radio${side === 'bride' ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="side"
                      checked={side === 'bride'}
                      onChange={() => setSide('bride')}
                    />
                    <span>신부측</span>
                  </label>
                </div>
              </fieldset>

              {attending === true ? (
                <>
                  <div className="rsvp-field">
                    <label htmlFor="rsvp-party">동행 인원 (본인 포함)</label>
                    <select
                      id="rsvp-party"
                      value={partySize}
                      onChange={(event) => setPartySize(Number(event.target.value))}
                    >
                      {PARTY_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}명
                        </option>
                      ))}
                    </select>
                  </div>

                  <fieldset className="rsvp-field rsvp-field--radio">
                    <legend>식사 여부</legend>
                    <div className="rsvp-radio-group">
                      <label className={`rsvp-radio${meal === 'yes' ? ' is-active' : ''}`}>
                        <input
                          type="radio"
                          name="meal"
                          checked={meal === 'yes'}
                          onChange={() => setMeal('yes')}
                        />
                        <span>식사함</span>
                      </label>
                      <label className={`rsvp-radio${meal === 'no' ? ' is-active' : ''}`}>
                        <input
                          type="radio"
                          name="meal"
                          checked={meal === 'no'}
                          onChange={() => setMeal('no')}
                        />
                        <span>식사 안 함</span>
                      </label>
                    </div>
                  </fieldset>
                </>
              ) : null}

              <div className="rsvp-field">
                <label htmlFor="rsvp-contact">연락처 (선택)</label>
                <input
                  id="rsvp-contact"
                  type="tel"
                  value={contact}
                  maxLength={RSVP_LIMITS.contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="예: 010-1234-5678"
                  autoComplete="tel"
                />
              </div>

              <hr className="rsvp-divider" aria-hidden="true" />

              <label htmlFor="guestbook-message">
                {myComment ? '내 축하 메시지' : '축하 메시지 (선택)'}
              </label>
              <textarea
                id="guestbook-message"
                value={message}
                maxLength={500}
                rows={4}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="따뜻한 한마디 남겨 주세요."
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
                {myRsvp || myComment ? (
                  <Edit3 size={17} aria-hidden="true" />
                ) : (
                  <Send size={17} aria-hidden="true" />
                )}
                {myRsvp || myComment ? '응답 수정하기' : '응답 보내기'}
              </button>
              {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
            </form>
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
