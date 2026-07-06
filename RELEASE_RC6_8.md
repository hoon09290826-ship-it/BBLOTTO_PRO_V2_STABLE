# BBLOTTO PRO RC6.8 STABLE

## 핵심 수정
- Railway/PostgreSQL 환경에서 `/api/members`가 `IndexError: tuple index out of range`로 실패하던 문제 수정
- 원인: psycopg2가 SQL의 `LIKE '%...%'` 리터럴 `%`를 포맷 문자로 해석함
- 해결: PostgreSQL 변환기에서 `%s` 플레이스홀더가 아닌 `%`를 안전하게 `%%`로 이스케이프
- 회원목록/회원검색/대시보드 조회 안정화
- 문자간다 CSV 대상 분리 기능 유지
- `/api/rc6-8/status` 점검 API 추가

## 배포 주의
- 실제 운영 DB는 GitHub ZIP에 포함하지 않습니다.
- Railway에서는 기존 `DATABASE_URL`/Volume을 그대로 사용해야 기존 회원 데이터가 유지됩니다.
- 업로드 후 브라우저에서 Ctrl+F5로 강력 새로고침하세요.
