# 웹 자동 제작의 프로젝트 문서·캔버스 포트

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

구현선: web-auto-ports. 긴 작업·중단 가능한 작업.

| 항목 | 결정과 증거 |
|---|---|
| 1 사용자 흐름 | 원고 읽기/쓰기 → 분镜 작성 → GPU 승인 → 후보 확인. 실제 프로젝트 두 개에서 원고/샷 생성 후 재접속; 자동 QA 재생성 제외. root 실제 GPU 검증. |
| 2 상태 소유 | 원고/분镜/캔버스는 기존 프로젝트 payload. mutateWebProject 직렬화와 expectedBinding으로 서버 저장. |
| 3 재사용 | 원고 schema/markdown/parser와 multiShotCanvasLanding 알고리즘을 React 없는 공유 owner로 추출. 원래 renderer는 같은 owner를 호출. |
| 4 전 상태 | 빈 원고 읽기는 빈 문자열; 잘못된 대상/전제는 기존 stale/input 오류; selection/insert는 unsupported; 성공은 기존 데이터로 표시. |
| 5 중단 | 저장 원자성과 프로젝트 쓰기 큐 사용. 탭 닫음/단절은 서버 데이터 유지. 재시작은 기존 원고/Run 투영 복원. 중복 materialize는 noop. |
| 6 외부 입력 | 기존 Zod storyboard schema와 document write preconditions 적용. 외부 LLM 데이터 실패는 원본 오류; GPU는 runtime 담당 선. |
| 7 성능 | 변경 없는 투영은 저장하지 않는다. 실제 최대 규모는 unverified. |
| 8 실제 조건 | Node unit 우선, zh/en 실제 브라우저/실제 GPU는 root 검증 전 unverified. |
| 9 검증·롤백 | 변경 테스트/타입 검사, 독립 acceptance 선으로 검토. 통합 commit revert 및 이전 clean release 복구. |
