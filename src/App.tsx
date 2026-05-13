import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  Camera,
  ChevronDown,
  Copy,
  Heart,
  MapPin,
  MessageCircle,
  Music,
  Pause,
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
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  const venueLocation = useMemo<Venue>(
    () => ({
      name: wedding.event.venue,
      address: wedding.event.address,
      lat: wedding.event.lat,
      lng: wedding.event.lng,
    }),
    [],
  );

  function showNotice(message: string) {
    setCopyStatus(message);
    window.setTimeout(() => setCopyStatus(''), 2200);
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
    const card = easeInOutCubic(progressBetween(displayedProgress, 0, 0.7));
    const copy = easeOutCubic(progressBetween(displayedProgress, 0.18, 0.8));
    const details = easeOutCubic(progressBetween(displayedProgress, 0.5, 0.98));

    return {
      '--intro-progress': displayedProgress.toFixed(3),
      '--card-y': `${24 - 24 * card}px`,
      '--card-scale': `${0.86 + 0.14 * card}`,
      '--card-width': `${960 + 160 * card}px`,
      '--card-min-height': `${540 + 200 * card}px`,
      '--copy-opacity': `${copy}`,
      '--copy-y': `${24 - 24 * copy}px`,
      '--details-opacity': `${details}`,
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
    setCopyStatus('주소가 복사되었습니다.');
    window.setTimeout(() => setCopyStatus(''), 2200);
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
    setCopyStatus('초대장 링크가 복사되었습니다.');
    window.setTimeout(() => setCopyStatus(''), 2200);
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
      <header className="site-nav" aria-label="청첩장 바로가기">
        <a className="site-nav__brand" href="#home" aria-label="처음으로">
          {wedding.couple.groom}
          <Heart size={14} aria-hidden="true" />
          {wedding.couple.bride}
        </a>
        <nav>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
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
                <button
                  className="icon-button icon-button--paper"
                  type="button"
                  aria-label={isMusicOn ? '음악 끄기' : '음악 켜기'}
                  onClick={() => setIsMusicOn((value) => !value)}
                >
                  {isMusicOn ? <Pause size={18} aria-hidden="true" /> : <Music size={18} aria-hidden="true" />}
                </button>
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
            {copyStatus ? <p className="copy-toast">{copyStatus}</p> : null}
          </div>
        </section>

        <Guestbook />

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
            {copyStatus ? <p className="copy-toast">{copyStatus}</p> : null}
          </div>
        </section>
      </main>

      {isAdmin ? <AdminPanel onClose={() => (window.location.hash = '#guestbook')} /> : null}
    </>
  );
}
