# BBLOTTO PRO V2 STABLE RC3-8

## 핵심 개선
- AI 추천번호 생성 후 조합 간 중복을 줄이는 RC3-8 포트폴리오 보정 추가
- 추천 결과에 RC3-8 품질 리포트 저장
- TOP3 카드에 실제 번호 표시 강화
- 엔진 표시 문구를 RC3-8 V2 Stable 기준으로 정리
- 관리자용 상태 점검 API 추가: `/api/rc3-8/health`
- 추천 이력 요약 API 추가: `/api/rc3-8/recommendation-summary`
- `/api/version`을 V2 Stable RC3-8 기준으로 갱신

## 업로드 방법
압축을 풀고 안에 있는 전체 내용을 GitHub 저장소에 업로드하세요.
Railway는 GitHub push 후 자동 배포됩니다.

## 배포 후 확인
1. `/api/version` 확인
2. 로그인 후 추천번호 생성
3. TOP3 카드에 번호/점수/등급 표시 확인
4. 기존 회원/추천 이력 유지 확인
