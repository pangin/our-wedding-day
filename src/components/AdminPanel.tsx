import { useEffect, useMemo, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import {
  isSupabaseConfigured,
  supabase,
  type GuestbookComment,
  type RsvpResponse,
} from '../lib/supabase';
import type { CommentStatus } from '../lib/commentPolicy';

type AdminPanelProps = {
  onClose: () => void;
};

type CommentAdminResponse = {
  comments?: GuestbookComment[];
  error?: string;
};

type RsvpAdminResponse = {
  rsvps?: RsvpResponse[];
  error?: string;
};

type AdminTab = 'guestbook' | 'rsvp';

const statusLabels: Record<CommentStatus, string> = {
  approved: '승인',
  pending: '대기',
  rejected: '거절',
  hidden: '숨김',
};

const sideLabels: Record<RsvpResponse['side'], string> = { groom: '신랑측', bride: '신부측' };
const mealLabels: Record<RsvpResponse['meal'], string> = {
  yes: '식사함',
  no: '식사 안 함',
  na: '해당 없음',
};

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('guestbook');
  const [comments, setComments] = useState<GuestbookComment[]>([]);
  const [rsvps, setRsvps] = useState<RsvpResponse[]>([]);
  const [status, setStatus] = useState('관리자 확인 중');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadComments();
    void loadRsvps();
  }, []);

  const pendingCount = useMemo(
    () => comments.filter((comment) => comment.status === 'pending').length,
    [comments],
  );

  const rsvpSummary = useMemo(() => {
    const summary = {
      total: rsvps.length,
      attending: 0,
      absent: 0,
      groom: 0,
      bride: 0,
      mealYes: 0,
      mealNo: 0,
      partyTotal: 0,
    };
    for (const r of rsvps) {
      if (r.attending) {
        summary.attending += 1;
        summary.partyTotal += r.party_size;
        if (r.meal === 'yes') summary.mealYes += 1;
        else if (r.meal === 'no') summary.mealNo += 1;
      } else {
        summary.absent += 1;
      }
      if (r.side === 'groom') summary.groom += 1;
      else if (r.side === 'bride') summary.bride += 1;
    }
    return summary;
  }, [rsvps]);

  async function loadComments() {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Supabase 환경 변수가 필요합니다.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<CommentAdminResponse>('admin-comments', {
      body: { action: 'list' },
    });

    setLoading(false);
    if (error || data?.error) {
      setStatus(data?.error ?? error?.message ?? '관리자 목록을 불러오지 못했습니다.');
      return;
    }

    setComments(data?.comments ?? []);
    setStatus('관리자 모드');
  }

  async function loadRsvps() {
    if (!isSupabaseConfigured || !supabase) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<RsvpAdminResponse>('admin-rsvp', {
      body: { action: 'list' },
    });

    setLoading(false);
    if (error || data?.error) {
      setStatus(data?.error ?? error?.message ?? 'RSVP 목록을 불러오지 못했습니다.');
      return;
    }

    setRsvps(data?.rsvps ?? []);
  }

  async function setCommentStatus(commentId: string, nextStatus: CommentStatus) {
    if (!supabase) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<CommentAdminResponse>('admin-comments', {
      body: { action: 'set-status', commentId, status: nextStatus },
    });

    setLoading(false);
    if (error || data?.error) {
      setStatus(data?.error ?? error?.message ?? '상태 변경에 실패했습니다.');
      return;
    }

    await loadComments();
  }

  async function deleteComment(commentId: string) {
    if (!supabase) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<CommentAdminResponse>('admin-comments', {
      body: { action: 'delete', commentId },
    });

    setLoading(false);
    if (error || data?.error) {
      setStatus(data?.error ?? error?.message ?? '삭제에 실패했습니다.');
      return;
    }

    await loadComments();
  }

  async function deleteRsvp(rsvpId: string) {
    if (!supabase) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<RsvpAdminResponse>('admin-rsvp', {
      body: { action: 'delete', rsvpId },
    });

    setLoading(false);
    if (error || data?.error) {
      setStatus(data?.error ?? error?.message ?? 'RSVP 삭제에 실패했습니다.');
      return;
    }

    await loadRsvps();
  }

  function downloadCsv<T extends Record<string, unknown>>(
    rows: T[],
    header: (keyof T & string)[],
    filename: string,
  ) {
    const csvHeader = header.join(',');
    const csvRows = rows.map((row) =>
      header
        .map((key) => {
          const value = row[key];
          const stringValue = value == null ? '' : String(value);
          return `"${stringValue.replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const blob = new Blob(['﻿', [csvHeader, ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadCommentsCsv() {
    downloadCsv<GuestbookComment>(
      comments,
      ['id', 'display_name', 'message', 'status', 'created_at', 'updated_at'],
      'guestbook-comments.csv',
    );
  }

  function downloadRsvpsCsv() {
    downloadCsv<RsvpResponse>(
      rsvps,
      [
        'id',
        'display_name',
        'attending',
        'side',
        'party_size',
        'meal',
        'contact',
        'message',
        'created_at',
        'updated_at',
      ],
      'rsvp-responses.csv',
    );
  }

  return (
    <aside className="admin-panel" aria-label="관리자 화면">
      <div className="admin-panel__bar">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>{tab === 'guestbook' ? '방명록 관리' : 'RSVP 응답'}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="관리자 화면 닫기">
          ×
        </button>
      </div>

      <div className="admin-panel__tabs" role="tablist" aria-label="관리자 탭">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guestbook'}
          className={`admin-tab${tab === 'guestbook' ? ' is-active' : ''}`}
          onClick={() => setTab('guestbook')}
        >
          방명록 ({comments.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rsvp'}
          className={`admin-tab${tab === 'rsvp' ? ' is-active' : ''}`}
          onClick={() => setTab('rsvp')}
        >
          RSVP ({rsvps.length})
        </button>
      </div>

      {tab === 'guestbook' ? (
        <>
          <div className="admin-panel__meta">
            <span>{status}</span>
            <span>대기 {pendingCount}개</span>
            <button
              className="button button--ghost"
              type="button"
              onClick={downloadCommentsCsv}
              disabled={!comments.length}
            >
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
          </div>

          <div className="admin-list" aria-busy={loading}>
            {comments.map((comment) => (
              <article className="admin-comment" key={comment.id}>
                <div>
                  <strong>{comment.display_name}</strong>
                  <span className={`status-pill status-pill--${comment.status}`}>
                    {statusLabels[comment.status]}
                  </span>
                </div>
                <p>{comment.message}</p>
                <time dateTime={comment.updated_at}>
                  {new Intl.DateTimeFormat('ko-KR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(comment.updated_at))}
                </time>
                <div className="admin-comment__actions">
                  <button
                    className="button button--small"
                    type="button"
                    onClick={() => setCommentStatus(comment.id, 'approved')}
                  >
                    <ShieldCheck size={16} aria-hidden="true" />
                    승인
                  </button>
                  <button
                    className="button button--small button--ghost"
                    type="button"
                    onClick={() => setCommentStatus(comment.id, 'hidden')}
                  >
                    숨김
                  </button>
                  <button
                    className="button button--small button--danger"
                    type="button"
                    onClick={() => deleteComment(comment.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="admin-panel__meta">
            <span>{status}</span>
            <button
              className="button button--ghost"
              type="button"
              onClick={downloadRsvpsCsv}
              disabled={!rsvps.length}
            >
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
          </div>

          <dl className="admin-rsvp-summary">
            <div>
              <dt>총 응답</dt>
              <dd>{rsvpSummary.total}</dd>
            </div>
            <div>
              <dt>참석</dt>
              <dd>{rsvpSummary.attending}</dd>
            </div>
            <div>
              <dt>불참</dt>
              <dd>{rsvpSummary.absent}</dd>
            </div>
            <div>
              <dt>신랑측</dt>
              <dd>{rsvpSummary.groom}</dd>
            </div>
            <div>
              <dt>신부측</dt>
              <dd>{rsvpSummary.bride}</dd>
            </div>
            <div>
              <dt>식사함</dt>
              <dd>{rsvpSummary.mealYes}</dd>
            </div>
            <div>
              <dt>식사 X</dt>
              <dd>{rsvpSummary.mealNo}</dd>
            </div>
            <div>
              <dt>동행 총합</dt>
              <dd>{rsvpSummary.partyTotal}명</dd>
            </div>
          </dl>

          <div className="admin-list" aria-busy={loading}>
            {rsvps.map((rsvp) => (
              <article className="admin-comment" key={rsvp.id}>
                <div>
                  <strong>{rsvp.display_name}</strong>
                  <span className={`status-pill status-pill--${rsvp.attending ? 'approved' : 'hidden'}`}>
                    {rsvp.attending ? '참석' : '불참'}
                  </span>
                  <span className="status-pill">{sideLabels[rsvp.side]}</span>
                  {rsvp.attending ? (
                    <>
                      <span className="status-pill">{rsvp.party_size}명</span>
                      <span className="status-pill">{mealLabels[rsvp.meal]}</span>
                    </>
                  ) : null}
                </div>
                {rsvp.contact ? <p className="admin-rsvp-contact">연락처: {rsvp.contact}</p> : null}
                {rsvp.message ? <p>{rsvp.message}</p> : null}
                <time dateTime={rsvp.updated_at}>
                  {new Intl.DateTimeFormat('ko-KR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(rsvp.updated_at))}
                </time>
                <div className="admin-comment__actions">
                  <button
                    className="button button--small button--danger"
                    type="button"
                    onClick={() => deleteRsvp(rsvp.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
