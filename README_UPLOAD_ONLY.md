# BBLOTTO PRO V2 STABLE - GitHub 업로드용

이 폴더 안의 내용 전체를 새 GitHub 저장소에 업로드하세요.

## 포함된 핵심 구조
- backend/ : FastAPI 백엔드, 관리자/회원/추천번호 API
- frontend/ : 웹 화면 파일
- database/ : 초기 로컬 SQLite DB
- Dockerfile, Procfile, railway.json : Railway 배포 설정
- requirements.txt, runtime.txt, start.py : 실행 설정

## 제거한 항목
- 예전 CHANGELOG/README/START_HERE/VALIDATION 파일
- .bat 실행 파일
- tests/, scripts/, deploy/
- exports/ 백업 DB
- __pycache__, *.pyc
- render.yaml, docker-compose.yml

## GitHub 업로드 방법
ZIP 파일 자체가 아니라 압축을 푼 뒤 이 폴더 안의 파일/폴더 전체를 업로드하세요.
