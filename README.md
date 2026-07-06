# BBLOTTO PRO V2 STABLE - GitHub Upload Clean Build

GitHub/Railway 업로드용으로 정리한 버전입니다.

## 포함 파일
- FastAPI backend
- frontend 정적 파일
- Railway/Docker 배포 파일
- 기본 SQLite DB 파일
- requirements.txt / runtime.txt / start.py

## 정리/수정 내용
- 불필요한 `__pycache__`, `.pyc` 제거
- DB 백업/Export 산출물 제거
- `.gitignore` 추가
- 회원관리 검색 보강
  - 이름/등급/상태/메모/등록관리자 검색
  - 전화번호 하이픈/공백 제거 검색
  - 최대 1000명 목록 기준 검색

## 실행
```bash
pip install -r requirements.txt
python start.py
```
