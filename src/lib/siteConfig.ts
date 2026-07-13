// 청첩장 전체 닫기 플래그. 'true' 면 예식 후 감사 인사 한 페이지만 남기고
// 나머지 섹션·네비게이션을 모두 숨긴다. 미설정/빈 값이면 청첩장 전체가 열림.
export const INVITATION_CLOSED = import.meta.env.VITE_INVITATION_CLOSED === 'true';
