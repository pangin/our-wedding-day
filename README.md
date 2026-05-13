# Our Wedding Day

성욱 & 혜경의 모바일 청첩장 사이트.

## 기술 스택

- **프론트엔드**: React + Vite + TypeScript
- **호스팅**: GitHub Pages (정적 배포)
- **인증 · 데이터**: Supabase (OAuth, DB, 관리자)
- **서버 로직**: Supabase Edge Functions
- **이미지 CDN**: Cloudinary (얼굴 인식 자동 크롭 + 라이트박스 뷰)
- **지도 임베드**: Kakao Maps JavaScript SDK
- **봇 차단 (옵션)**: Cloudflare Turnstile
- **콘텐츠 모더레이션 (옵션)**: Google Cloud Natural Language

## 아키텍처 개요

- 정적 사이트로 빌드되어 GitHub Actions를 통해 GitHub Pages에 배포됩니다.
- 클라이언트는 OAuth로 Supabase에 로그인하고, 민감한 쓰기는 Edge Function을 거치며 RLS로 권한이 통제됩니다.
- 갤러리는 Ken Burns + 페이드 캐러셀로 자동 재생되며, 클릭 시 풀스크린 라이트박스가 열립니다.

## 디렉터리 구조

- `src/components` — 화면 컴포넌트
- `src/lib` — 도메인 로직 (Supabase 클라이언트, 지도 링크 등)
- `src/content` — 청첩장 콘텐츠 데이터
- `supabase/functions` — Edge Functions
- `supabase/migrations` — DB 스키마 + RLS 정책
- `tools` — 개발 유틸 스크립트 (사진 압축 등)

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 필요한 값 채우기
npm run dev
```

## 검증

```bash
npm run typecheck
npm test
npm run build
```
