import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  Camera,
  ChevronDown,
  Copy,
  Heart,
  MapPin,
  MessageCircle,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { Gallery } from './components/Gallery';
import { Guestbook } from './components/Guestbook';
import { MapEmbed } from './components/MapEmbed';
import { MapPickerDialog } from './components/MapPickerDialog';
import { wedding } from './content/wedding';
import { buildGoogleCalendarUrl } from './lib/commentPolicy';
import { pulseSnap } from './lib/haptic';
import type { Venue } from './lib/mapLinks';
import { useHash } from './hooks/useHash';

const sections = [
  { id: 'gallery', label: '사진' },
  { id: 'venue', label: '오시는 길' },
  { id: 'account', label: '마음 전하기' },
  { id: 'guestbook', label: '방명록' },
];

type InvitationState = 'ready' | 'opened' | 'replaying';
type MotionStyle = CSSProperties & Record<`--${string}`, string>;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function progressBetween(progress: number, start: number, end: number) {
  return clamp01((progress - start) / (end - start));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function App() {
  const hash = useHash();
  const introRef = useRef<HTMLElement | null>(null);
  const [invitationState, setInvitationState] = useState<InvitationState>('ready');
  const [introProgress, setIntroProgress] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  });
  const autoOpenedRef = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);
  const activeIndexRef = useRef<number>(-1);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const handler = (event: MediaQueryListEvent) => setIsTouchDevice(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const ids = sections.map((s) => s.id);

    function recompute() {
      const sentinelY = window.scrollY + 100;
      let nextIndex = -1;
      for (let i = 0; i < ids.length; i += 1) {
        const el = document.getElementById(ids[i]);
        if (!el) continue;
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (sentinelY >= top && sentinelY < bottom) {
          nextIndex = i;
          break;
        }
      }
      if (nextIndex !== activeIndexRef.current) {
        const prevIndex = activeIndexRef.current;
        activeIndexRef.current = nextIndex;
        setActiveSection(nextIndex >= 0 ? ids[nextIndex] : null);
        if (prevIndex !== -1 || nextIndex !== -1) {
          pulseSnap();
        }
      }
    }

    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        recompute();
      });
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    recompute();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    function updateIndicator() {
      const navEl = navRef.current;
      if (!navEl) return;
      if (!activeSection) {
        navEl.style.setProperty('--indicator-opacity', '0');
        return;
      }
      const link = navEl.querySelector<HTMLElement>(`a[data-section-id="${activeSection}"]`);
      if (!link) return;
      const navBox = navEl.getBoundingClientRect();
      const linkBox = link.getBoundingClientRect();
      navEl.style.setProperty('--indicator-x', `${linkBox.left - navBox.left}px`);
      navEl.style.setProperty('--indicator-w', `${linkBox.width}px`);
      navEl.style.setProperty('--indicator-opacity', '1');
    }
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeSection]);

  useEffect(() => {
    if (invitationState !== 'ready') return;
    if (autoOpenedRef.current) return;
    if (window.scrollY > 4) return;

    const events: Array<keyof WindowEventMap> = [
      'wheel',
      'touchstart',
      'pointerdown',
      'keydown',
      'scroll',
    ];

    let timer = 0;
    const cancel = () => {
      autoOpenedRef.current = true;
      window.clearTimeout(timer);
      detach();
    };
    const detach = () => {
      events.forEach((name) => window.removeEventListener(name, cancel));
    };

    timer = window.setTimeout(() => {
      detach();
      const intro = introRef.current;
      if (!intro) return;
      autoOpenedRef.current = true;
      const rect = intro.getBoundingClientRect();
      const introTop = rect.top + window.scrollY;
      const target = introTop + Math.max(0, rect.height - window.innerHeight);
      window.scrollTo({ top: target, behavior: 'smooth' });
    }, 10000);

    events.forEach((name) => window.addEventListener(name, cancel, { passive: true }));

    return () => {
      window.clearTimeout(timer);
      detach();
    };
  }, [invitationState]);

  const venueLocation = useMemo<Venue>(
    () => ({
      name: wedding.event.venue,
      address: wedding.event.address,
      lat: wedding.event.lat,
      lng: wedding.event.lng,
    }),
    [],
  );

  const toastTimerRef = useRef(0);
  function showNotice(message: string) {
    setCopyStatus(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setCopyStatus(''), 2400);
  }

  const eventDate = useMemo(() => new Date(wedding.event.date), []);
  const calendarUrl = useMemo(() => {
    const end = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString();
    return buildGoogleCalendarUrl({
      title: wedding.links.calendarTitle,
      start: wedding.event.date,
      end,
      location: `${wedding.event.venue}, ${wedding.event.address}`,
      details: wedding.copy.invitation,
    });
  }, [eventDate]);

  const isAdmin = hash === '#admin';
  const displayedProgress = invitationState === 'opened' ? 1 : introProgress;
  const invitationMotion = useMemo<MotionStyle>(() => {
    const opening = easeOutCubic(progressBetween(displayedProgress, 0, 0.36));
    const card = easeInOutCubic(progressBetween(displayedProgress, 0.12, 0.82));
    const photo = easeOutCubic(progressBetween(displayedProgress, 0.2, 0.72));
    const copy = easeOutCubic(progressBetween(displayedProgress, 0.42, 0.88));
    const details = easeOutCubic(progressBetween(displayedProgress, 0.62, 0.96));

    return {
      '--intro-progress': displayedProgress.toFixed(3),
      '--opening-opacity': `${1 - opening}`,
      '--opening-y': `${-42 * opening}px`,
      '--card-y': `${120 - 120 * card}px`,
      '--card-scale': `${0.88 + 0.12 * card}`,
      '--card-opacity': `${progressBetween(displayedProgress, 0.08, 0.28)}`,
      '--card-width': `${960 + 160 * card}px`,
      '--card-min-height': `${540 + 200 * card}px`,
      '--photo-opacity': `${photo}`,
      '--photo-scale': `${1.06 - 0.06 * photo}`,
      '--copy-opacity': `${copy}`,
      '--copy-y': `${26 - 26 * copy}px`,
      '--details-opacity': `${details}`,
      '--backdrop-opacity': `${0.62 - 0.24 * card}`,
      '--backdrop-scale': `${1.12 - 0.08 * card}`,
      '--backdrop-blur': `${8 - 8 * card}px`,
    };
  }, [displayedProgress]);

  useEffect(() => {
    if (invitationState === 'opened') {
      setIntroProgress(1);
      return;
    }

    let frame = 0;
    const updateProgress = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const intro = introRef.current;
        if (!intro) {
          return;
        }

        const rect = intro.getBoundingClientRect();
        const scrollable = Math.max(1, rect.height - window.innerHeight);
        const nextProgress = clamp01(-rect.top / scrollable);
        setIntroProgress(nextProgress);

        if (invitationState === 'ready' && nextProgress >= 0.985) {
          setInvitationState('opened');
        } else if (invitationState === 'replaying' && window.scrollY <= 1) {
          setInvitationState('ready');
        }
      });
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [invitationState]);

  async function copyAddress() {
    await navigator.clipboard.writeText(`${wedding.event.venue} ${wedding.event.address}`);
    showNotice('주소가 복사되었습니다.');
  }

  async function copyAccount(account: { name: string; bank: string; number: string }) {
    try {
      await navigator.clipboard.writeText(`${account.bank} ${account.number} ${account.name}`);
      showNotice(`${account.name} 계좌번호가 복사되었습니다.`);
    } catch {
      showNotice('계좌번호 복사에 실패했어요. 직접 복사해 주세요.');
    }
  }

  async function shareInvitation() {
    const url = window.location.href.split('#')[0];
    if (navigator.share) {
      await navigator.share({
        title: wedding.couple.headline,
        text: wedding.links.shareText,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    showNotice('초대장 링크가 복사되었습니다.');
  }

  function replayInvitation() {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (window.scrollY <= 1) {
      setInvitationState('ready');
      setIntroProgress(0);
      return;
    }

    setInvitationState('replaying');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <header
        className={`site-nav site-nav--${invitationState}`}
        aria-label="청첩장 바로가기"
        aria-hidden={invitationState !== 'opened'}
      >
        <a className="site-nav__brand" href="#home" aria-label="처음으로">
          {wedding.couple.groom}
          <Heart size={14} aria-hidden="true" />
          {wedding.couple.bride}
        </a>
        <nav ref={navRef}>
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-section-id={section.id}
              aria-current={activeSection === section.id ? 'page' : undefined}
            >
              {section.label}
            </a>
          ))}
          <span className="site-nav__indicator" aria-hidden="true" />
        </nav>
      </header>

      <main>
        <section
          className={`invitation-intro invitation-intro--${invitationState}`}
          id="home"
          ref={introRef}
          style={invitationMotion}
        >
          <div className="invitation-stage">
            <img className="invitation-backdrop" src={wedding.images.hero} alt="" aria-hidden="true" />
            <div className="invitation-backdrop__shade" />
            <div className="opening-copy" aria-hidden={invitationState === 'opened'}>
              <p>Wedding Invitation</p>
              <h1>
                {wedding.couple.groom}
                <Heart size={42} aria-hidden="true" strokeWidth={1.5} />
                {wedding.couple.bride}
              </h1>
              <span>
                {isTouchDevice ? '손가락으로 밀어서 초대장을 펼쳐보세요' : '스크롤해서 초대장을 펼쳐보세요'}
              </span>
              <span className="opening-gesture" aria-hidden="true">
                {isTouchDevice ? (
                  <svg viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g className="opening-gesture__touch">
                      <circle
                        cx="20"
                        cy="9"
                        r="6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="rgba(255, 250, 242, 0.14)"
                      />
                      <circle cx="20" cy="9" r="2" fill="currentColor" />
                    </g>
                    <line
                      x1="20"
                      y1="22"
                      x2="20"
                      y2="36"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeDasharray="2 3"
                      strokeLinecap="round"
                      opacity="0.55"
                    />
                    <path
                      className="opening-gesture__arrow"
                      d="M14 42 L20 49 L26 42"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect
                      x="11"
                      y="3"
                      width="18"
                      height="32"
                      rx="9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <line
                      className="opening-gesture__dot"
                      x1="20"
                      y1="11"
                      x2="20"
                      y2="17"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                    <path
                      className="opening-gesture__arrow"
                      d="M14 42 L20 49 L26 42"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                )}
              </span>
            </div>
            <article className="invitation-card" aria-label="성욱과 혜경의 청첩장">
              <div className="invitation-card__media">
                <img className="invitation-card__photo" src={wedding.images.heroCard} alt="결혼식 초대장 대표 사진" />
              </div>
              <div className="invitation-card__body">
                <p className="invitation-card__eyebrow">Wedding Invitation</p>
                <p className="invitation-card__date">{wedding.event.displayDate}</p>
                <h1>{wedding.couple.headline}</h1>
                <p className="invitation-card__names">
                  {wedding.couple.groom}
                  <Heart size={22} aria-hidden="true" strokeWidth={1.6} />
                  {wedding.couple.bride}
                </p>
                <ul className="invitation-card__lineage" aria-label="가족 소개">
                  <li>
                    <span>{wedding.families.groom.father} · {wedding.families.groom.mother}</span>
                    <span className="invitation-card__lineage-rel">의 {wedding.families.groom.relation}</span>
                    <strong>{wedding.families.groom.fullName}</strong>
                  </li>
                  <li>
                    <span>{wedding.families.bride.father} · {wedding.families.bride.mother}</span>
                    <span className="invitation-card__lineage-rel">의 {wedding.families.bride.relation}</span>
                    <strong>{wedding.families.bride.fullName}</strong>
                  </li>
                </ul>
                <p className="invitation-card__copy">{wedding.copy.opening}</p>
                <dl className="invitation-card__details">
                  <div>
                    <dt>일시</dt>
                    <dd>{wedding.event.displayDate}</dd>
                  </div>
                  <div>
                    <dt>장소</dt>
                    <dd>{wedding.event.venue} · {wedding.event.hall}</dd>
                  </div>
                </dl>
              </div>
            </article>
          </div>
          <a className="intro-next" href="#gallery" aria-label="다음 섹션으로 이동">
            <ChevronDown size={22} aria-hidden="true" />
          </a>
        </section>

        <section className="section section--gallery" id="gallery">
          <div className="section__inner gallery-layout">
            <div className="section-copy">
              <p className="eyebrow">Gallery</p>
              <h2>기억하고 싶은 장면들</h2>
              <p>가장 우리다운 순간들을 천천히 넘겨 보세요.</p>
            </div>
            <Gallery images={wedding.images.gallery} />
          </div>
        </section>

        <section className="section section--venue" id="venue">
          <div className="section__inner venue-layout">
            <div className="event-card">
              <p className="eyebrow">Wedding Day</p>
              <h2>{wedding.event.displayDate}</h2>
              <p>{wedding.event.venue}</p>
              <p>{wedding.event.hall}</p>
              <p>{wedding.event.address}</p>
              <dl className="venue-details">
                <div>
                  <dt>교통</dt>
                  <dd>{wedding.event.transit}</dd>
                </div>
                <div>
                  <dt>주차</dt>
                  <dd>{wedding.event.parking}</dd>
                </div>
                <div>
                  <dt>연락처</dt>
                  <dd>{wedding.event.phone}</dd>
                </div>
              </dl>
              <div className="event-card__actions">
                <a className="button" href={calendarUrl} target="_blank" rel="noreferrer">
                  <CalendarPlus size={17} aria-hidden="true" />
                  캘린더
                </a>
                <button className="button button--ghost" type="button" onClick={copyAddress}>
                  <Copy size={17} aria-hidden="true" />
                  주소 복사
                </button>
              </div>
            </div>
            <div className="venue-map">
              <MapEmbed venue={venueLocation} />
              <button
                type="button"
                className="button button--map"
                onClick={() => setIsMapPickerOpen(true)}
              >
                <MapPin size={17} aria-hidden="true" />
                지도 열기
              </button>
            </div>
          </div>
        </section>

        <MapPickerDialog
          open={isMapPickerOpen}
          venue={venueLocation}
          onClose={() => setIsMapPickerOpen(false)}
          onNotice={showNotice}
        />

        <section className="section section--account" id="account">
          <div className="section__inner account-layout">
            <div className="section-copy">
              <p className="eyebrow">Heartful</p>
              <h2>{wedding.copy.accountsHeading}</h2>
              <p>{wedding.copy.accountsNote}</p>
            </div>
            <div className="account-groups">
              {(['groom', 'bride'] as const).map((side) => (
                <details className="account-group" key={side} open>
                  <summary>
                    <span className="account-group__label">
                      {side === 'groom' ? '신랑측' : '신부측'}
                    </span>
                    <span className="account-group__person">
                      {wedding.families[side].fullName}
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className="account-group__chevron"
                    />
                  </summary>
                  <ul className="account-list">
                    {wedding.accounts[side].map((account) => (
                      <li className="account-row" key={`${side}-${account.name}`}>
                        <div className="account-row__info">
                          <p className="account-row__role">
                            <span>{account.role}</span>
                            <strong>{account.name}</strong>
                          </p>
                          <p className="account-row__number">
                            {account.bank} {account.number}
                          </p>
                        </div>
                        <button
                          className="button button--ghost button--small account-row__copy"
                          type="button"
                          onClick={() => copyAccount(account)}
                          aria-label={`${account.name} 계좌번호 복사`}
                        >
                          <Copy size={15} aria-hidden="true" />
                          <span className="account-row__copy-label">복사</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </section>

        <Guestbook onNotice={showNotice} />

        <section className="section section--share" id="share">
          <div className="section__inner share-layout">
            <div>
              <p className="eyebrow">Thank You</p>
              <h2>{wedding.copy.footer}</h2>
            </div>
            <div className="share-actions">
              <button className="button" type="button" onClick={shareInvitation}>
                <Share2 size={17} aria-hidden="true" />
                공유
              </button>
              <a className="button button--ghost" href="#guestbook">
                <MessageCircle size={17} aria-hidden="true" />
                방명록
              </a>
              <a className="button button--ghost" href="#gallery">
                <Camera size={17} aria-hidden="true" />
                사진
              </a>
              <button className="button button--ghost" type="button" onClick={replayInvitation}>
                <RotateCcw size={17} aria-hidden="true" />
                청첩장 다시 넣기
              </button>
            </div>
          </div>
        </section>
      </main>

      <div
        className="copy-toast"
        role="status"
        aria-live="polite"
        data-visible={copyStatus ? 'true' : 'false'}
      >
        {copyStatus}
      </div>

      {isAdmin ? <AdminPanel onClose={() => (window.location.hash = '#guestbook')} /> : null}
    </>
  );
}
