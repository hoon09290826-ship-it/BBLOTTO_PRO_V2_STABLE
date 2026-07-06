# BBLOTTO PRO V2 STABLE - RC5-12

## 목표
GitHub/Railway 업로드 이후 실행 안정성과 진단 기능을 강화한 배포 안정화 버전입니다.

## 적용 내용
- 앱 버전 표기를 RC5-12로 정리
- `/api/health` 응답에 `rc_version` 추가
- `/api/rc5-12/status` 배포 진단 API 추가
- Python 런타임을 Dockerfile과 동일한 3.11로 통일
- `.env.example` 추가 및 환경변수 기준 정리
- 불필요한 캐시/임시파일 제거

## 배포 후 확인
1. `/api/health` 접속
2. `/api/rc5-12/status` 접속
3. 회원관리에서 이름/전화번호/등급 검색 확인
