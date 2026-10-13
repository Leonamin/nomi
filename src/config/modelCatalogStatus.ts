import type { BillingModelKind, ModelCatalogHealthDto } from '../workbench/api/modelCatalogApi'
import type { ModelOption, NodeKind } from './models'
import i18n from '../i18n'

export function resolveCatalogKind(kind?: NodeKind): BillingModelKind {
  if (kind === 'image' || kind === 'imageEdit') {
    return 'image'
  }
  if (kind === 'video') {
    return 'video'
  }
  if (kind === 'audio') {
    return 'audio'
  }
  // 3D 模型节点：其目录桶就是 'model3d'（catalog 按 kind 拉取时才拉得到已接入的 3D 模型，
  // 否则落回 'text' 桶 → 3D 节点的模型选择器永远空 → 生成路径断在选型）。
  if (kind === 'model3d') {
    return 'model3d'
  }
  return 'text'
}

export function normalizeCatalogLoadError(caught: unknown): Error {
  if (caught instanceof Error) {
    const message = caught.message.trim()
    if (caught instanceof TypeError || /failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
      return new Error(i18n.t('runtime.modelCatalog.desktopUnavailable'))
    }
    return caught
  }
  return new Error(i18n.t('runtime.modelCatalog.loadFailed'))
}

export type ModelCatalogStatus = 'loading' | 'api_unreachable' | 'catalog_empty' | 'kind_empty' | 'incomplete' | 'ready'

export function deriveModelCatalogStatus(input: {
  kind?: NodeKind
  options: readonly ModelOption[]
  health: ModelCatalogHealthDto | null
  error: Error | null
  healthError?: Error | null
  loading: boolean
}): { status: ModelCatalogStatus; message: string } {
  if (input.loading) {
    return { status: 'loading', message: i18n.t('runtime.modelCatalog.loading') }
  }
  if (input.error) {
    return {
      status: 'api_unreachable',
      message: i18n.t('runtime.modelCatalog.loadFailedWithMessage', { message: input.error.message }),
    }
  }
  if (input.healthError) {
    return {
      status: 'api_unreachable',
      message: i18n.t('runtime.modelCatalog.healthFailed', { message: input.healthError.message }),
    }
  }
  const catalogKind = resolveCatalogKind(input.kind)
  const health = input.health
  const kindLabel = i18n.t(`runtime.modelCatalog.kind.${catalogKind}` as 'runtime.modelCatalog.kind.image')
  if (health?.issues.some((issue) => issue.code === 'catalog_empty' && issue.severity === 'error')) {
    return { status: 'catalog_empty', message: i18n.t('runtime.modelCatalog.empty') }
  }
  const kindSummary = health?.byKind.find((item) => item.kind === catalogKind)
  if (kindSummary && kindSummary.enabledModels === 0) {
    return { status: 'kind_empty', message: i18n.t('runtime.modelCatalog.noKind', { kind: kindLabel }) }
  }
  // 「이 kind를 잠글 것인가」는 **실제로 돌릴 수 있는 모델이 하나도 없을 때만** true다.
  //
  // 2026-10-13 실측(개인 웹 배포): 씨앗 클라우드 모델이 키 없이 켜져 있으면 per-model 이슈가
  // 146개 error로 잡히고, 그중 아무거나 kind가 맞기만 하면 kind 전체가 잠겼다 — 쓸 수 있는
  // 모델이 있어도 모든 카드가 「모델 목록 설정이 완성되지 않았어요」로 막혔다(image: enabled 59 /
  // executable 2). per-model 이슈(키 없음·벤더 꺼짐)는 "그 모델은 못 돌린다"는 그 모델의 상태이지
  // kind의 상태가 아니다. 판정의 owner는 catalogHealth가 이미 내려 보내는 `executableModels`
  // (전 앱 유일한 가용성 판정, shared/modelAvailability)이고 여기서 다시 계산하지 않는다.
  //
  // `byKind`가 다루지 않는 kind(model3d)만 옛 이슈 게이트를 그대로 쓴다.
  const kindLocked = kindSummary
    ? kindSummary.executableModels === 0
    : health?.issues.some(
        (issue) => issue.severity === 'error' && (issue.kind === catalogKind || typeof issue.kind === 'undefined'),
      )
  if (kindLocked) {
    return { status: 'incomplete', message: i18n.t('runtime.modelCatalog.incomplete') }
  }
  if (input.options.length === 0) {
    return { status: 'kind_empty', message: i18n.t('runtime.modelCatalog.noKind', { kind: kindLabel }) }
  }
  return { status: 'ready', message: i18n.t('runtime.modelCatalog.ready') }
}
