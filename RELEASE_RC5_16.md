# BBLOTTO PRO RC5-16

## 목적
GitHub 업로드 전 보안/정리 최종 패치입니다.

## 적용 내용
- `.gitignore` 강화
- `.env.example` 추가
- `__pycache__`, `.pyc` 제거
- 운영 DB `database/bblotto_v34.db` 제거
- 백업 DB/exports DB 제거
- `database/.gitkeep` 유지
- 기본 관리자 비밀번호 `admin1234` 하드코딩 제거
- `BBLOTTO_ADMIN_USERNAME`, `BBLOTTO_ADMIN_PASSWORD` 환경변수 지원
- 환경변수가 없으면 임시 비밀번호 자동 생성 후 서버 로그 출력
- RC 버전 `RC5-16_SECURITY_CLEANUP` 반영

## GitHub 업로드 주의
`.env`, 실제 DB, 백업 DB는 절대 업로드하지 마세요.
