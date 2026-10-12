export const koRecovery = {
  checkingTitle: '요청 접수 여부 확인 중',
  checking: '서비스가 요청을 받았는지 확인하고 있어요. 확인하는 동안 다시 보내지 않습니다.',
  checkingTask: (reference: string) => `서비스의 작업 ${reference}을 확인하고 있어요. 확인하는 동안 다시 보내지 않습니다.`,
  uncertainTitle: '이미 접수됐을 수 있어요',
  uncertain: '요청 접수 여부가 확실하지 않아요. 서비스에서 확인한 뒤 결정하세요. 자동으로 다시 보내지 않습니다.',
  uncertainTask: (reference: string) => `서비스가 작업 ${reference}을 이미 받았을 수 있어요. 계속 확인할 수 있으며 자동으로 다시 보내지 않습니다.`,
  reviewTitle: '요청 접수 여부를 확인해 주세요',
  review: '서비스가 이미 요청을 받았을 수 있어요. 먼저 서비스에서 확인한 뒤 새로 요청할지 결정하세요. 자동으로 다시 보내지 않습니다.',
  detachedTitle: '기다리기를 중지했어요',
  cancellingTitle: '작업 취소 확인 중',
  detached: 'Nomi는 기다리기를 중지했지만 서비스에서는 작업이 계속될 수 있어요. 서비스에서 최종 상태를 확인하세요.',
  cancelling: '서비스에 취소 결과를 확인하고 있어요. 확인하는 동안 다시 요청하지 않습니다.',
  stoppedTitle: '중지됐어요',
  stopped: '이번 생성을 중지했어요. 자동으로 새 요청을 보내지 않습니다.',
}

export const koProductionNotice = {
  attention: ['Nomi · 확인이 필요한 작업', '진행이 멈춘 작업이 있어요. 눌러서 이유와 다시 진행할 방법을 확인하세요.'],
  submission_unknown: ['Nomi · 요청 접수 여부 불확실', '요금이 중복 청구되지 않도록 서비스의 작업 상태를 확인하세요.'],
  gate: ['Nomi · 확인을 기다리고 있어요', '제작이 잠시 멈췄어요. 눌러서 내용을 확인하고 결정하세요.'],
  completed: ['Nomi · 제작 완료', '영상과 소재를 프로젝트에 저장했어요. 눌러서 확인하세요.'],
} as const
