# BBLOTTO PRO RC6-9 POSTGRES SQL HOTFIX

## Fixed
- PostgreSQL/psycopg2에서 SQL 내부 `LIKE '%...%'` 리터럴 때문에 발생하던 `IndexError: tuple index out of range` 수정
- `/api/members?limit=500&sort=priority` 500 오류 방어
- 회원목록이 0명처럼 보이는 문제 원인 수정

## Notes
- 기존 DB는 포함하지 않습니다.
- Railway PostgreSQL 또는 DATABASE_URL 환경에서 동작하도록 SQL 변환 로직을 보강했습니다.
