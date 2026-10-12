import type { HandbookFirstWinStep, HandbookGotcha, HandbookIntentRoute, HandbookPipelineStep } from '../../../workbench/onboarding/handbookContent'

const pipeline: HandbookPipelineStep[] = [
  { iconKey: 'pencil', label: '아이디어 적기' },
  { iconKey: 'scissors', label: '장면 나누기' },
  { iconKey: 'layout-grid', label: '카드 만들기' },
  { iconKey: 'wand', label: '인물·카메라 정하기' },
  { iconKey: 'timeline', label: '순서 정하기' },
  { iconKey: 'movie', label: 'MP4로 저장', accent: true },
]
const firstWin: HandbookFirstWinStep[] = [
  { n: 1, title: '만드는 순서 살펴보기', body: '프로젝트 목록에서 영상 만드는 순서를 볼 수 있어요. 생성 비용 없이 예제로 먼저 살펴보세요.' },
  { n: 2, title: '사용할 AI 연결하기', body: '이미지나 영상을 만드는 AI를 모델이라고 불러요. 모델 설정에서 사용할 서비스를 연결하세요. 외부 서비스 비용은 해당 계정에 청구됩니다.' },
  { n: 3, title: '장면 하나 설명하기', body: '창작 화면에 아이디어를 적고 장면으로 나눠 달라고 요청하세요. 장면 계획을 확인한 뒤 이미지나 영상 카드를 만드세요.' },
  { n: 4, title: '만든 결과를 영상으로 저장하기', body: '장면 카드에서 생성하고, 결과를 타임라인에 배치하세요. 타임라인은 장면 순서와 길이를 정하는 곳이에요. 재생해 본 뒤 MP4로 내보내세요.' },
]
const intentRoutes: HandbookIntentRoute[] = [
  { iconKey: 'user-check', title: '여러 장면에 같은 인물 나오게 하기', body: '인물 참고 카드를 만들고 각 장면에 연결하세요. AI가 같은 인물의 모습을 참고합니다.' },
  { iconKey: 'box', title: '인물 위치와 방향 정하기', body: '3D 화면에서 인물과 카메라를 배치하고, 만든 구도를 AI의 참고 이미지로 사용하세요.' },
  { iconKey: 'device-gamepad-2', title: '움직임과 카메라 이동 정하기', body: '3D 화면에서 WASD로 움직이고 동작과 카메라를 정하세요. 녹화한 영상을 생성할 때 참고 자료로 넣을 수 있어요.' },
  { iconKey: 'typography', title: '영상 순서와 길이 다듬기', body: '타임라인에 결과를 배치한 뒤 재생해 보세요. 장면을 옮기거나 길이를 조절할 수 있어요.' },
  { iconKey: 'alert-triangle', title: '말에 맞춰 입 모양 움직이기', body: '정확한 입 모양 맞추기는 아직 지원하지 않습니다.', warn: true },
]
const gotchas: HandbookGotcha[] = [
  { iconKey: 'plug-connected-x', title: '모델을 연결했는데 대화가 안 돼요', body: '대화와 장면 계획에는 텍스트 모델이 필요해요. 이미지·영상 모델과 별도로 연결했는지 확인하세요.' },
  { iconKey: 'mood-confuzed', title: '장면마다 인물 모습이 달라요', body: '같은 인물 참고 카드가 각 장면에 연결되어 있는지 확인하세요.' },
  { iconKey: 'alert-circle', title: '연결한 모델을 사용할 수 없어요', body: '오류 안내를 확인하세요. 서비스의 이용 권한이나 잔액, 추가 인증이 필요할 수 있어요.' },
  { iconKey: 'volume-off', title: '저장한 영상에 소리가 없어요', body: '타임라인의 오디오 트랙에 소리가 배치되어 있는지 확인하세요.' },
]

export function koreanHandbookContent(isWeb: boolean) {
  if (isWeb) {
    return {
      title: '첫 영상 만들기',
      subtitle: '처음에는 짧은 장면 하나부터 만들어 보세요.',
      pipeline: [pipeline[0], pipeline[2], { iconKey: 'wand', label: '이미지·영상 생성' }, pipeline[4], pipeline[5]],
      firstWin: [
        { n: 1, title: '새 프로젝트 만들기', body: '장면 설명과 이미지, 편집 내용을 모아 둘 곳이에요. “학교 소개 영상”처럼 찾기 쉬운 이름을 붙여 주세요.' },
        { n: 2, title: '만들고 싶은 장면 적기', body: '생성 화면에서 이미지 카드를 추가하고 장면을 적어 주세요. 예: “아침 햇빛이 들어오는 학교 도서관. 책상에는 책과 공책이 놓여 있다.”' },
        { n: 3, title: '이미지나 영상 만들기', body: '연결된 ComfyUI 모델을 고르고 생성을 시작하세요. 모델은 이미지나 영상을 만드는 AI예요. 사용할 모델이 없다면 운영자에게 연결을 확인해 달라고 요청하세요.' },
        { n: 4, title: '순서 정하고 영상 파일로 저장하기', body: '결과를 타임라인에 배치하고 재생해 보세요. 타임라인은 장면 순서와 길이를 정하는 곳이에요. 마음에 들면 MP4로 내보내세요.' },
      ],
      intentRoutes: [
        { iconKey: 'layout-grid', title: '새 결과로 편집한 장면 바꾸기', body: '현재 후보를 고르는 일과 이미 배치한 장면을 바꾸는 일은 별도예요. 생성 카드의 결과 목록에서 장면 교체를 사용하세요.' },
        { iconKey: 'movie', title: '영상 파일 받기', body: '프로젝트와 결과는 서버에 저장돼요. 내보내기가 끝나면 다운로드해서 받으세요.' },
        { iconKey: 'alert-triangle', title: 'AI에게 영상 제작 맡기기', body: '현재 개인 웹은 직접 카드를 조작하는 ComfyUI 생성 방식입니다. AI 자동 제작은 제공하지 않습니다.', warn: true },
      ] satisfies HandbookIntentRoute[],
      gotchas: [
        { iconKey: 'plug-connected-x', title: '선택할 모델이 없어요', body: '운영자에게 ComfyUI 연결과 모델 등록을 확인해 달라고 요청하세요.' },
        { iconKey: 'alert-circle', title: '새 영상으로 장면을 바꿀 수 없어요', body: '새 영상이 타임라인에서 사용하는 구간보다 짧은지 확인하세요.' },
        { iconKey: 'mood-confuzed', title: '서버에 다시 연결하라고 나와요', body: '페이지를 새로고침하고 작업 상태를 확인하세요. 같은 생성을 연달아 누르지 마세요.' },
        { iconKey: 'volume-off', title: '저장한 영상에 소리가 없어요', body: '타임라인에 오디오가 배치되어 있고, 소리가 꺼져 있지 않은지 확인하세요.' },
      ],
    }
  }
  return { title: '첫 영상 만들기', subtitle: '아이디어를 적고 장면을 만들어 영상으로 저장해 보세요.', pipeline, firstWin, intentRoutes, gotchas }
}
