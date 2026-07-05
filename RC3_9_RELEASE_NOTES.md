# BBLOTTO PRO V2 Stable RC3-9

## 핵심 개선
- DB/백업/관리자 로그 안정화 점검 API 추가
- 수동 백업 생성 API 추가
- 관리자 활동 감사 API 추가
- 추천번호 생성 이력 감사 API 추가
- 운영 기준 DB 확인 API 추가
- `/api/version` 버전 정보를 RC3-9로 갱신

## 추가 API
- `GET /api/rc3-9/status`
- `POST /api/rc3-9/backup-create`
- `GET /api/rc3-9/admin-audit`
- `GET /api/rc3-9/recommendation-audit`
- `GET /api/rc3-9/db-standard`

## 업로드 안내
압축을 풀고 안에 있는 전체 내용을 GitHub 저장소 최상위에 업로드하세요.
