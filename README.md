# Badminton Game Maker

배드민턴 조 대 조 복식 경기 운영을 위한 웹 앱입니다.

다음 기능을 지원합니다.

- 전체 인원 입력 및 자동 이름 생성
- 조 편성 생성과 드래그앤드롭 선수 이동
- 조 편성 JSON Export / Import
- 15분 단위 코트별 시간표 자동 생성
- 경기 결과 입력(승패/점수) 및 순위 계산
- 테스트 탭에서 공평성 통계 확인

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Supabase(PostgreSQL 스키마 초안 포함)
- Vitest / Testing Library / Stryker

## Run

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run test:mutation
npm run build
```

## Project Structure

- `src/app/BadmintonApp.tsx`: 메인 화면/상태/조 편성/대진표 UI
- `src/lib/scheduler`: 조 편성/시간표 생성 로직
- `src/lib/scoring`: 결과 집계/순위 계산 로직
- `src/lib/fairness`: 공평성 통계 계산
- `src/lib/grouping-io`: 조 편성 JSON Export/Import 유틸
- `supabase/schema.sql`: DB 스키마
