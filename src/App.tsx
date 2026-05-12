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
import { Guestbook } from './components/Guestbook';
import { MapEmbed } from './components/MapEmbed';
import { MapPickerDialog } from './components/MapPickerDialog';
import { wedding } from './content/wedding';
import { buildGoogleCalendarUrl } from './lib/commentPolicy';
import type { Venue } from './lib/mapLinks';
import { useHash } from './hooks/useHash';

const sections = [
  { id: 'story', label: '스토리' },
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
  const [selectedImage, setSelectedImage] = useState(wedding.images.gallery[0]);
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
    const opening = easeOutCubic(progressBetween(displayedProgress, 0, 0.36));
    const card = easeInOutCubic(progressBetween(displayedProgress, 0.12, 0.82));
    const photo = easeOutCubic(progressBetween(displayedProgress, 0.2, 0.72));
    const copy = easeOutCubic(progressBetween(displayedProgress, 0.42, 0.88));
    const details = easeOutCubic(progressBetween(displayedProgress, 0.62, 0.96));

    return {
      '--intro-progress': displayedProgress.toFixed(3),
      '--opening-opacity': `${1 - opening}`,
      '--opening-y': `${-42 * opening}px`,
      '--card-y': `${118 - 118 * card}px`,
      '--card-scale': `${0.88 + 0.12 * card}`,
      '--card-opacity': `${progressBetween(displayedProgress, 0.08, 0.26)}`,
      '--card-width': `${620 + 500 * card}px`,
      '--card-min-height': `${460 + 250 * card}px`,
      '--photo-opacity': `${photo}`,
      '--photo-scale': `${1.08 - 0.08 * photo}`,
      '--copy-opacity': `${copy}`,
      '--copy-y': `${26 - 26 * copy}px`,
      '--details-opacity': `${details}`,
      '--backdrop-opacity': `${0.88 - 0.42 * card}`,
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
          <Heart size={18} aria-hidden="true" />
          {wedding.couple.groom} & {wedding.couple.bride}
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
            <img className="invitation-backdrop" src={wedding.images.hero} alt="" aria-hidden="true" />
            <div className="invitation-backdrop__shade" />
            <div className="opening-copy" aria-hidden={invitationState === 'opened'}>
              <p>Wedding Invitation</p>
              <h1>{wedding.couple.groom} & {wedding.couple.bride}</h1>
              <span>스크롤해서 초대장을 펼쳐보세요</span>
            </div>
            <article className="invitation-card" aria-label="성욱과 혜경의 청첩장">
              <div className="invitation-card__media">
                <img className="invitation-card__photo" src={wedding.images.hero} alt="결혼식 초대장 대표 사진" />
              </div>
              <div className="invitation-card__body">
                <p className="invitation-card__date">{wedding.event.displayDate}</p>
                <h1>{wedding.couple.headline}</h1>
                <p className="invitation-card__names">
                  {wedding.couple.groom} <span>&</span> {wedding.couple.bride}
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
          <a className="intro-next" href="#story" aria-label="다음 섹션으로 이동">
            <ChevronDown size={22} aria-hidden="true" />
          </a>
        </section>

        <section className="section section--intro" id="story">
          <div className="section__inner intro-layout">
            <div className="section-copy">
              <p className="eyebrow">Invitation</p>
              <h2>같은 방향을 바라보며</h2>
              <p className="section-copy__lead">{wedding.copy.invitationLead}</p>
              <ul className="lineage" aria-label="양가 가족 소개">
                <li>
                  <span className="lineage__parents">
                    {wedding.families.groom.father} · {wedding.families.groom.mother}
                  </span>
                  <span className="lineage__relation">의 {wedding.families.groom.relation}</span>
                  <strong className="lineage__name">{wedding.families.groom.fullName}</strong>
                </li>
                <li>
                  <span className="lineage__parents">
                    {wedding.families.bride.father} · {wedding.families.bride.mother}
                  </span>
                  <span className="lineage__relation">의 {wedding.families.bride.relation}</span>
                  <strong className="lineage__name">{wedding.families.bride.fullName}</strong>
                </li>
              </ul>
              <p>{wedding.copy.invitation}</p>
            </div>
            <div className="timeline" aria-label="우리 이야기">
              {wedding.timeline.map((item) => (
                <article className="timeline__item" key={item.title}>
                  <time>{item.date}</time>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--gallery" id="gallery">
          <div className="section__inner gallery-layout">
            <div className="section-copy">
              <p className="eyebrow">Gallery</p>
              <h2>기억하고 싶은 장면들</h2>
              <p>가장 우리다운 순간들을 천천히 넘겨 보세요.</p>
            </div>
            <div className="gallery-stage">
              <figure>
                <img src={selectedImage.src} alt={selectedImage.alt} />
                <figcaption>{selectedImage.caption}</figcaption>
              </figure>
              <div className="gallery-strip" aria-label="갤러리 사진 선택">
                {wedding.images.gallery.map((image) => (
                  <button
                    className={image.id === selectedImage.id ? 'is-selected' : ''}
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    aria-label={`${image.caption} 보기`}
                  >
                    <img src={image.src} alt="" />
                  </button>
                ))}
              </div>
            </div>
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
