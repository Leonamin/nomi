import type { ProjectTemplate, ProjectTemplateId } from '../../../workbench/library/projectTemplates'
import type { StoryboardPlan } from '../../../workbench/generationCanvas/agent/storyboardPlan'

export const koreanTemplateText: Record<ProjectTemplateId, Pick<ProjectTemplate, 'name' | 'description' | 'seedDocument'>> = {
  'manga-short': {
    name: '애니메이션 단편',
    description: '5분 분량의 애니메이션. 장면, 인물, 배경, 소품과 오디오 분류가 준비돼 있어요.',
    seedDocument: '# 1막\n\n@인물 주인공 { 외모 / 성격 / 목표 }\n\n# 2막\n\n# 3막\n',
  },
  'product-demo': {
    name: '제품 소개 영상',
    description: '30–60초 분량의 SaaS 제품 소개. 장면, 배경, 소품과 오디오 분류가 준비돼 있어요.',
    seedDocument: '# 30초 제품 소개 대본\n\n1. 문제 (5초):\n2. 해결 방법 (10초):\n3. 사용 모습 (10초):\n4. 다음 행동 안내 (5초):\n',
  },
  'free-form': { name: '자유롭게 만들기', description: '다섯 분류를 모두 사용하고, 빈 내용으로 시작해요.', seedDocument: '' },
}

export const koreanDemoName = '예제: 작은 로봇 고치기'
export const koreanDemoStory = [
  '해 질 무렵 골목 한쪽에 작은 로봇이 고장 난 채 기대어 있다. 주변에는 부품이 흩어져 있다.',
  '학교에서 돌아오던 아이가 쪼그려 앉아 로봇을 들여다본다.',
  '아이는 로봇을 집으로 데려와 스탠드 아래에서 나사를 하나씩 조이며 고친다.',
  '마지막 나사를 조이자 로봇의 눈이 짧은 소리와 함께 켜진다.',
  '둘은 옥상에 올라 나란히 앉아 해가 지는 모습을 바라본다.',
].join('\n')

export const koreanDemoPlan: StoryboardPlan = {
  title: '작은 로봇 고치기',
  anchors: [
    { id: 'kid', kind: 'character', name: '아이', description: '짧은 머리에 노란 후드티를 입고 낡은 책가방을 멘 열 살쯤 된 남자아이. 호기심이 많고 다정하다.', carrier: 'visual' },
    { id: 'robot', kind: 'character', name: '작은 로봇', description: '손바닥만 한 둥근 머리의 오래된 로봇. 은색 외장이 닳아 있고 가슴에는 따뜻한 노란 불빛이 켜진다. 움직임은 서툴고 귀엽다.', carrier: 'visual' },
    { id: 'rooftop', kind: 'scene', name: '해 질 무렵 옥상', description: '도시의 오래된 아파트 옥상. 물탱크와 빨랫줄이 있고 멀리 건물들이 주황빛 노을에 물들어 있다.', carrier: 'visual' },
  ],
  shots: [
    { index: 1, durationSec: 4, anchorIds: ['robot'], prompt: '해 질 무렵 골목을 넓게 보여 준다. 고장 난 작은 로봇이 벽에 기대어 있고 흩어진 부품에 따뜻한 옆빛이 비친다.' },
    { index: 2, durationSec: 3, anchorIds: ['kid', 'robot'], prompt: '아이가 쪼그려 앉아 작은 로봇을 호기심 있게 들여다보는 중간 거리 화면.' },
    { index: 3, durationSec: 4, anchorIds: ['kid', 'robot'], prompt: '아이가 작은 로봇을 안고 집으로 가는 뒷모습을 따라간다.' },
    { index: 4, durationSec: 4, anchorIds: ['kid', 'robot'], prompt: '스탠드 아래에서 아이가 드라이버로 로봇을 조심스럽게 고치는 손을 가까이 보여 준다.' },
    { index: 5, durationSec: 3, anchorIds: ['robot'], prompt: '로봇 가슴의 따뜻한 노란 불빛과 눈이 켜지는 모습을 가까이 보여 준다.' },
    { index: 6, durationSec: 3, anchorIds: ['kid', 'robot'], prompt: '아이와 로봇이 서로를 바라본다. 로봇이 고개를 갸웃한다. 둘을 한 화면에 담는다.' },
    { index: 7, durationSec: 4, anchorIds: ['kid', 'robot', 'rooftop'], prompt: '옥상에 나란히 앉아 먼 곳을 바라보는 아이와 로봇을 뒤에서 중간 거리로 보여 준다.' },
    { index: 8, durationSec: 5, anchorIds: ['kid', 'robot', 'rooftop'], prompt: '주황빛 하늘 아래 둘의 실루엣을 담고 카메라가 천천히 멀어진다.' },
  ],
}
