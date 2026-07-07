# RC7-4 SMSGANDA HEADER FIX

- 문자간다 XLS 다운로드 시 한글 파일명이 HTTP 헤더에 직접 들어가 서버 500 오류가 나는 문제 수정
- filename은 영문, filename*는 UTF-8 인코딩으로 처리
- 프론트 오류 메시지가 [object Object]로 보이는 문제 수정
- /api/rc7-4/status 추가
