import { useEffect, useMemo, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { isSupabaseConfigured, supabase, type GuestbookComment } from '../lib/supabase';
import type { CommentStatus } from '../lib/commentPolicy';

type AdminPanelProps = {
  onClose: () => void;
};

type AdminActionResponse = {
  comments?: GuestbookComment[];
  error?: string;
};

const statusLabels: Record<CommentStatus, string> = {
  approved: '승인',
  pending: '대기',
  rejected: '거절',
  hidden: '숨김',
};

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [comments, setComments] = useState<GuestbookComment[]>([]);
  const [status, setStatus] = useState('관리자 확인 중');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadComments();
  }, []);

  const pendingCount = useMemo(
    () => comments.filter((comment) => comment.status === 'pending').length,
    [comments],
  );

  async function loadComments() {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Supabase 환경 변수가 필요합니다.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<AdminActionResponse>('admin-comments', {
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

  async function setCommentStatus(commentId: string, nextStatus: CommentStatus) {
    if (!supabase) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<AdminActionResponse>('admin-comments', {
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
    if (!supabase) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke<AdminActionResponse>('admin-comments', {
      body: { action: 'delete', commentId },
    });

    setLoading(false);
    if (error || data?.error) {
      setStatus(data?.error ?? error?.message ?? '삭제에 실패했습니다.');
      return;
    }

    await loadComments();
  }

  function downloadCsv() {
    const header = ['id', 'display_name', 'message', 'status', 'created_at', 'updated_at'];
    const rows = comments.map((comment) =>
      header
        .map((key) => {
          const value = String(comment[key as keyof GuestbookComment] ?? '');
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'guestbook-comments.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="admin-panel" aria-label="관리자 댓글 관리">
      <div className="admin-panel__bar">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>방명록 관리</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="관리자 화면 닫기">
          ×
        </button>
      </div>

      <div className="admin-panel__meta">
        <span>{status}</span>
        <span>대기 {pendingCount}개</span>
        <button className="button button--ghost" type="button" onClick={downloadCsv} disabled={!comments.length}>
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
    </aside>
  );
}
