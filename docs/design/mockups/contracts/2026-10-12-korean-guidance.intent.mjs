// 사용자가 2026-10-12 승인한 한국어 말투와 용어의 체험 샘플.
// 앱 레이아웃 재설계 승인이 아니다. 아래 계약은 샘플을 이루는 관계만 검증한다.
// 실제 앱의 언어 선택, 번역 누락, 안내 내용은 한국어 UX walk에서 따로 확인한다.
const authority = {
  mockup: 'docs/design/mockups/2026-10-12-korean-guidance/index.html',
  mechanizes: {
    sections: ['프로젝트 시작', '언어 선택', '처음 쓰는 학생용 안내'],
    migratedAt: '2026-10-12',
  },
  layer: 'intent',
}

// 초기 프로젝트 화면에서 실행한다.
export default {
  ...authority,
  surface: '한국어 안내 샘플 · 프로젝트 시작',
  structure: [
    { name: '프로젝트 제목이 시작 행동보다 먼저 나온다', before: 'main header h1', after: '[aria-label="프로젝트 시작"]' },
    { name: '새 프로젝트와 순서 안내를 같은 시작 영역에서 찾는다', ancestor: '[aria-label="프로젝트 시작"]', descendant: 'button', minCount: 2 },
    { name: '직접 시작하기가 순서 안내보다 먼저 나온다', before: '[aria-label="프로젝트 시작"] > button:first-child', after: '[aria-label="프로젝트 시작"] > button:nth-child(2)' },
    { name: '시작 행동마다 제목 아래에 짧은 설명이 붙는다', ancestor: '[aria-label="프로젝트 시작"] > button > span', descendant: 'span', minCount: 4 },
    { name: '프로젝트 시작 행동은 검색보다 앞에 놓인다', before: '[aria-label="프로젝트 시작"]', after: '[aria-label="프로젝트 검색"]' },
  ],
}

// openPanel('settings') 이후 실행한다. 세 언어를 한 그룹으로 선택한다.
export const settingsContract = {
  ...authority,
  surface: '한국어 안내 샘플 · 언어 선택',
  structure: [
    { name: '언어 선택은 설정 본문에 포함된다', ancestor: '#panel-body', descendant: '[role="group"][aria-label="언어 선택"]' },
    { name: '한국어를 기존 두 언어와 같은 그룹에서 선택한다', ancestor: '[role="group"][aria-label="언어 선택"]', descendant: 'button', minCount: 3 },
    { name: '선택 결과 안내는 언어 버튼 뒤에 나온다', before: '[aria-label="언어 선택"]', after: '#language-note' },
  ],
}

// openPanel('guide') 이후 실행한다. 각 단계의 행동을 먼저 읽고 설명을 읽는다.
export const guideContract = {
  ...authority,
  surface: '한국어 안내 샘플 · 첫 영상 만들기',
  structure: [
    { name: '안내 제목이 본문보다 먼저 나온다', before: '#panel-title', after: '#panel-body' },
    { name: '네 단계가 순서 있는 목록 안에 들어간다', ancestor: '#panel-body ol', descendant: 'li', minCount: 4 },
    { name: '각 단계에 행동 제목과 쉬운 설명이 함께 있다', ancestor: '#panel-body ol > li', descendant: 'p', minCount: 8 },
    ...[1, 2, 3, 4].map((step) => ({
      name: `${step}단계는 행동을 먼저 말하고 필요한 설명을 붙인다`,
      before: `#panel-body ol > li:nth-child(${step}) > p:first-child`,
      after: `#panel-body ol > li:nth-child(${step}) > p:nth-child(2)`,
    })),
    { name: '웹의 저장·생성 범위는 만드는 순서 다음에 명시한다', before: '#panel-body ol', after: '#panel-body > p:last-child' },
  ],
}
