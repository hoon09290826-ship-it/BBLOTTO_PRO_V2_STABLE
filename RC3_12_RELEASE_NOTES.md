# BBLOTTO PRO V2 STABLE RC3-12

## 핵심 개선
- 회원 선택 → 추천번호 생성 → 추천이력 저장 → 회원별 당첨확인 흐름 보강
- 추천 생성 시 회원 선택 안내 강화
- 당첨 자동확인 결과에서 회원명 누락 시 members 테이블과 재연결
- 기존 회원 미연결 추천이력 점검 API 추가
- 기존 미연결 추천이력을 특정 회원으로 연결하는 복구 API 추가

## 추가 API
- GET /api/rc3-12/status
- GET /api/rc3-12/member-link-status
- POST /api/rc3-12/link-orphan-recommendations
