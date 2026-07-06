# BBLOTTO PRO V2 STABLE - RC5-13

## 목표
GitHub/Railway 업로드 직전 점검을 더 쉽게 하기 위한 배포 가드 버전입니다.

## 적용 내용
- 앱 버전: `RC5-13_RELEASE_GUARD`
- `/api/rc5-13/status` 진단 API 추가
- 필수 파일 존재 여부 점검
- 핵심 DB 테이블 카운트 점검
- GitHub 업로드 금지 캐시 파일 점검
- exports 백업 DB 제거 및 `.gitkeep` 유지
- `__pycache__`, `.pyc`, `.bak`, `.tmp` 제거

## 배포 후 확인
1. `/api/health`
2. `/api/rc5-13/status`
3. 회원관리 검색
4. 추천번호 생성
5. 당첨확인
