import { describe, expect, it } from 'vitest'
import { deriveModelCatalogStatus, resolveCatalogKind } from './modelCatalogStatus'
import type { ModelOption } from './models'
import type { ModelCatalogHealthDto, ModelCatalogHealthIssueDto } from '../workbench/api/modelCatalogApi'

describe('resolveCatalogKind', () => {
  it('maps each node kind to its own catalog bucket (never silently to text)', () => {
    expect(resolveCatalogKind('image')).toBe('image')
    expect(resolveCatalogKind('imageEdit')).toBe('image')
    expect(resolveCatalogKind('video')).toBe('video')
    expect(resolveCatalogKind('audio')).toBe('audio')
    // Regression: a 3D node must fetch from the 'model3d' catalog bucket. Falling
    // back to 'text' left the 3D composer's model selector permanently empty
    // (options filtered against text models by text_to_3d mode → nothing), so the
    // 3D generation path was stuck with no way to pick an already-onboarded model.
    expect(resolveCatalogKind('model3d')).toBe('model3d')
  })

  it('defaults unknown/text kinds to the text bucket', () => {
    expect(resolveCatalogKind('text')).toBe('text')
    expect(resolveCatalogKind(undefined)).toBe('text')
  })
})

const option: ModelOption = { value: 'comfyui-local--candidate/comfy-leo-h3', label: 'Leo H3' }

function health(input: {
  byKind: ModelCatalogHealthDto['byKind']
  issues?: ModelCatalogHealthIssueDto[]
}): ModelCatalogHealthDto {
  return {
    ok: (input.issues ?? []).every((issue) => issue.severity !== 'error'),
    counts: {
      vendors: 21,
      enabledVendors: 17,
      models: 155,
      enabledModels: 153,
      mappings: 245,
      enabledMappings: 245,
      enabledApiKeys: 0,
    },
    byKind: input.byKind,
    issues: input.issues ?? [],
  }
}

const keylessSeedIssue: ModelCatalogHealthIssueDto = {
  code: 'vendor_api_key_missing',
  severity: 'error',
  message: 'API key missing: kie',
  vendorKey: 'kie',
  modelKey: 'minimax-h3',
  kind: 'video',
}

function status(input: Parameters<typeof deriveModelCatalogStatus>[0]) {
  return deriveModelCatalogStatus(input).status
}

describe('deriveModelCatalogStatus kind locking', () => {
  // 2026-10-13 개인 웹 배포 실측 회귀: 키 없는 씨앗 클라우드 모델 146개가 error로 잡혀
  // (executable image 2/59) 카드가 통째로 잠겼다. per-model 이슈는 그 모델의 상태이지 kind의 상태가 아니다.
  it('keeps a kind usable while it still has executable models, even with hundreds of per-model errors', () => {
    expect(status({
      kind: 'video',
      options: [option],
      health: health({
        byKind: [{ kind: 'video', enabledModels: 54, executableModels: 3 }],
        issues: [keylessSeedIssue],
      }),
      error: null,
      loading: false,
    })).toBe('ready')
  })

  it('reports incomplete when the kind has enabled models but none of them can run', () => {
    expect(status({
      kind: 'video',
      options: [option],
      health: health({
        byKind: [{ kind: 'video', enabledModels: 54, executableModels: 0 }],
        issues: [keylessSeedIssue],
      }),
      error: null,
      loading: false,
    })).toBe('incomplete')
  })

  it('reports kind_empty when nothing in the kind is enabled at all', () => {
    expect(status({
      kind: 'image',
      options: [],
      health: health({ byKind: [{ kind: 'image', enabledModels: 0, executableModels: 0 }] }),
      error: null,
      loading: false,
    })).toBe('kind_empty')
  })

  it('keeps the issue gate for kinds the health summary does not cover (model3d)', () => {
    expect(status({
      kind: 'model3d',
      options: [option],
      health: health({
        byKind: [{ kind: 'image', enabledModels: 59, executableModels: 2 }],
        issues: [{ ...keylessSeedIssue, kind: 'model3d' }],
      }),
      error: null,
      loading: false,
    })).toBe('incomplete')
  })

  it('still reports catalog_empty for an empty catalog regardless of kind', () => {
    expect(status({
      kind: 'video',
      options: [option],
      health: health({
        byKind: [{ kind: 'video', enabledModels: 0, executableModels: 0 }],
        issues: [{ code: 'catalog_empty', severity: 'error', message: 'Local model catalog is empty' }],
      }),
      error: null,
      loading: false,
    })).toBe('catalog_empty')
  })

  it('still falls back to kind_empty when this node mode has no options', () => {
    expect(status({
      kind: 'video',
      options: [],
      health: health({ byKind: [{ kind: 'video', enabledModels: 54, executableModels: 3 }] }),
      error: null,
      loading: false,
    })).toBe('kind_empty')
  })
})
