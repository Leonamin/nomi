import { expect, it, vi } from 'vitest';
import { resolveProductionReferenceUrls, retryOnReferenceScopeChange } from './productionReferenceUrls';
import { spendReferenceKey } from '../shared/contracts/pendingSpendConfirm';
const reference = { assetId: 'asset', contentHash: 'hash', version: 1, kind: 'image' as const, role: 'first_frame' as const };
function fixture() {
  const assets = { list: () => [{ id: 'asset', data: {url:'nomi-local://asset/p/ref.png',contentType:'image/png'} }], identity: () => ({contentHash:'hash',version:1}), import: vi.fn() };
  return { assets, localize: vi.fn(async () => ['https://cdn.example/ref.png']) };
}
it('localizes pinned project assets through the existing transport before sealing', async () => {
  const deps = fixture();
  expect(await resolveProductionReferenceUrls({projectId:'p',providerId:'apimart',references:[reference],assertCurrent(){}},deps)).toEqual({[spendReferenceKey(reference)]:'https://cdn.example/ref.png'});
  expect(deps.localize).toHaveBeenCalledWith('apimart',['nomi-local://asset/p/ref.png']);
});
it('rejects changed content before upload and after asynchronous upload', async () => {
  const deps = fixture();
  deps.assets.identity = () => ({contentHash:'changed',version:1});
  await expect(resolveProductionReferenceUrls({projectId:'p',providerId:'apimart',references:[reference],assertCurrent(){}},deps)).rejects.toThrow('identity_changed');
  expect(deps.localize).not.toHaveBeenCalled();
  deps.assets.identity = () => ({contentHash:'hash',version:1});
  deps.localize.mockImplementation(async () => { deps.assets.identity = () => ({contentHash:'changed',version:1}); return ['https://cdn.example/ref.png']; });
  await expect(resolveProductionReferenceUrls({projectId:'p',providerId:'apimart',references:[reference],assertCurrent(){}},deps)).rejects.toThrow('identity_changed');
});
it('rejects a retired project after upload', async () => {
  let current = true;
  const deps = fixture(); deps.localize.mockImplementation(async () => { current = false; return ['https://cdn.example/ref.png']; });
  await expect(resolveProductionReferenceUrls({projectId:'p',providerId:'apimart',references:[reference],assertCurrent(){if(!current)throw new Error('stale_project')}},deps)).rejects.toThrow('stale_project');
});

// 批量「生成剩下 N 张」：上一镜的调度 / 落画布写入在下一镜上传参考图的异步窗口里推进了 revision。
// 每次尝试都重新取快照（宿主闭包内），所以重试封的是最新 revision；真实的素材身份变化照旧封死。
function snapshotAttempt(state: { revision: number }, deps: ReturnType<typeof fixture>, onFirstLocalize: () => void) {
  let first = true;
  deps.localize.mockImplementation(async () => { if (first) { first = false; onFirstLocalize(); } return ['https://cdn.example/ref.png']; });
  return async () => {
    const snapshot = state.revision;
    await resolveProductionReferenceUrls({ projectId: 'p', providerId: 'apimart', references: [reference], assertCurrent() { if (state.revision !== snapshot) throw new Error('generation_reference_scope_changed'); } }, deps);
    return snapshot;
  };
}
it('re-snapshots and succeeds when the revision moves during upload', async () => {
  const state = { revision: 1 }, deps = fixture();
  const attempt = snapshotAttempt(state, deps, () => { state.revision += 1; });
  await expect(attempt()).rejects.toThrow('generation_reference_scope_changed');
  state.revision = 1; deps.localize.mockClear();
  const retried = snapshotAttempt(state, deps, () => { state.revision += 1; });
  expect(await retryOnReferenceScopeChange(retried)).toBe(2);
});
it('gives up after bounded attempts and never retries other failures', async () => {
  const stale = vi.fn(async () => { throw new Error('generation_reference_scope_changed'); });
  await expect(retryOnReferenceScopeChange(stale)).rejects.toThrow('generation_reference_scope_changed');
  expect(stale).toHaveBeenCalledTimes(3);
  const deps = fixture(); deps.assets.identity = () => ({ contentHash: 'changed', version: 1 });
  const changed = vi.fn(() => resolveProductionReferenceUrls({ projectId: 'p', providerId: 'apimart', references: [reference], assertCurrent() {} }, deps));
  await expect(retryOnReferenceScopeChange(changed)).rejects.toThrow('identity_changed');
  expect(changed).toHaveBeenCalledTimes(1);
});
it('survives writes during every upload (video rendering) by reusing the first upload on retry', async () => {
  // Wan 렌더 중에는 Run 진행 쓰기가 매 업로드 창마다 들어온다：重试也重新上传的话三次全输（2026-10-19 实测）。
  const state = { revision: 1 }, deps = fixture();
  deps.localize.mockImplementation(async () => { state.revision += 1; return ['https://cdn.example/ref.png']; });
  const attempt = async () => {
    const snapshot = state.revision;
    await resolveProductionReferenceUrls({ projectId: 'p', providerId: 'apimart', references: [reference], assertCurrent() { if (state.revision !== snapshot) throw new Error('generation_reference_scope_changed'); } }, deps);
    return snapshot;
  };
  expect(await retryOnReferenceScopeChange(attempt)).toBe(2);
  expect(deps.localize).toHaveBeenCalledTimes(1);
  // 记忆只活在一次重试里：下一次独立授权照常重新上传。
  await retryOnReferenceScopeChange(attempt).catch(() => undefined);
  expect(deps.localize).toHaveBeenCalledTimes(2);
});
