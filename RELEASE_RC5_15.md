# BBLOTTO PRO V2 STABLE - RC5-15

## 목표
GitHub/Railway 업로드 직전 안정성 점검을 강화한 버전입니다.

## 적용 내용
- RC 버전 `RC5-15_PRE_RELEASE_GUARD` 반영
- `/api/rc5-15/status` 진단 API 추가
- `scripts/verify_release.py` 배포 전 검증 스크립트 추가
- Railway 시작 명령/PORT 사용 여부 점검
- 프론트엔드 localhost 하드코딩 여부 점검
- 캐시/임시/백업/대용량 파일 점검 강화

## 확인 방법
```bash
python scripts/verify_release.py
python -m py_compile backend/app.py start.py
```

배포 후:
```text
/api/health
/api/rc5-15/status
```
