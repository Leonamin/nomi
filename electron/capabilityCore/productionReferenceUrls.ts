import { AsyncLocalStorage } from 'node:async_hooks';
import { buildViewUrl, comfyInputName } from '../catalog/comfyuiLocal';
import { rewriteVendorUrl } from '../vendor/vendorBaseFallback';
import { readCatalog } from '../catalog/catalogStore';
import { localizeAssetsForVendor } from '../catalog/assetLocalization';
import { assetIngestionResolver, assetLocalizationOptions } from '../catalog/assetTransportRuntime';
import { readNomiLocalAsset, postJsonForAssetUpload, postMultipartForAssetUpload, putBinaryForAssetUpload } from '../assets/localAssetFile';
import { projectSpendReferenceAssets, type SpendReferenceAssets } from './pendingSpendReferences';
import { spendReferenceKey } from '../shared/contracts/pendingSpendConfirm';
import type { GenerationReference } from '../shared/agentCapabilities/generationPlanSchemas';

/** Existing asset transport performs uploads before the deterministic request seal. */
async function localize(providerId: string, urls: readonly string[]): Promise<readonly string[]> {
  const catalog = readCatalog();
  const vendor = catalog.vendors.find(vendor => vendor.key === providerId);
  if (!vendor) throw new Error('generation_reference_provider_unavailable');
  const resolveIngestion = assetIngestionResolver(vendor, catalog);
  const uploadEndpoints = new Set<string>();
  const uploadedViewUrls = new Map<string, string>();
  const result = await localizeAssetsForVendor({ urls }, kind => {
    const candidates = resolveIngestion(kind);
    for (const candidate of candidates) if (candidate.ingestion.strategy === 'comfyui-upload') uploadEndpoints.add(candidate.ingestion.endpoint);
    return candidates;
  }, readNomiLocalAsset, postJsonForAssetUpload, async (...args) => {
    const response = await postMultipartForAssetUpload(...args);
    if (uploadEndpoints.has(args[0])) {
      const receipt = response && typeof response === 'object' && !Array.isArray(response) ? response as Record<string, unknown> : {};
      const name = receipt.name, subfolder = receipt.subfolder ?? '';
      let inputName: string;
      try { inputName = comfyInputName({ filename: name, subfolder, type: receipt.type }); } catch { throw new Error('generation_reference_upload_receipt_invalid'); }
      const endpoint = new URL(rewriteVendorUrl(args[0]));
      if (!['http:', 'https:'].includes(endpoint.protocol) || !endpoint.pathname.endsWith('/upload/image')) throw new Error('generation_reference_upload_endpoint_invalid');
      const base = endpoint.origin + endpoint.pathname.slice(0, -'/upload/image'.length);
      uploadedViewUrls.set(inputName, buildViewUrl(base, { filename: name, subfolder, type: 'input' }));
    }
    return response;
  }, assetLocalizationOptions(undefined), putBinaryForAssetUpload);
  const localized = (result.value as { urls?: unknown }).urls;
  if (!Array.isArray(localized) || localized.length !== urls.length) throw new Error('generation_reference_url_unavailable');
  const values = localized.map(value => typeof value === 'string' && uploadedViewUrls.has(value) ? uploadedViewUrls.get(value)! : value);
  if (values.some(value => typeof value !== 'string' || !/^https?:\/\//.test(value))) throw new Error('generation_reference_url_unavailable');

  return values;
}

export async function resolveProductionReferenceUrls(input: Readonly<{
  projectId: string;
  providerId: string;
  references: readonly GenerationReference[];
  assertCurrent: () => void;
}>, deps: Readonly<{
  assets: SpendReferenceAssets;
  localize: typeof localize;
}> = { assets: projectSpendReferenceAssets, localize }): Promise<Readonly<Record<string, string>>> {
  input.assertCurrent();
  if (input.references.length === 0) return {};
  const indexed = deps.assets.list(input.projectId);
  const verify = (reference: GenerationReference): void => {
    const identity = deps.assets.identity(input.projectId, reference.assetId);
    if (!identity || identity.contentHash !== reference.contentHash || identity.version !== reference.version) {
      throw new Error('generation_reference_identity_changed');
    }
  };
  const urls = input.references.map(reference => {
    verify(reference);
    const asset = indexed.find(asset => asset.id === reference.assetId);
    if (!asset || typeof asset.data.url !== 'string') throw new Error('generation_reference_asset_unavailable');
    if (reference.kind && (typeof asset.data.contentType !== 'string' || !asset.data.contentType.startsWith(`${reference.kind}/`))) {
      throw new Error('generation_reference_kind_mismatch');
    }
    return asset.data.url;
  });
  // 重试里复用上一次 attempt 的上传结果：不再有 I/O 等待，快照与 assertCurrent 之间就插不进别的写入。
  const memo = localizedInRetry.getStore(), memoKey = `${input.providerId}\n${urls.join('\n')}`;
  const localized = memo?.get(memoKey) ?? await deps.localize(input.providerId, urls);
  memo?.set(memoKey, localized);
  input.assertCurrent();
  input.references.forEach(verify);
  if (localized.length !== input.references.length) throw new Error('generation_reference_url_unavailable');
  return Object.fromEntries(input.references.map((reference, index) => [spendReferenceKey(reference), localized[index]]));
}

const SCOPE_CHANGED = 'generation_reference_scope_changed';
const SCOPE_RETRY_ATTEMPTS = 3;

/**
 * 乐观并发：快照（项目 revision + Run revision）在上传参考图的异步窗口里可能被我们自己的写入推进
 * （批量里上一镜的调度 / 画布落地；视频渲染中 Run 进度写得很密）。每次 attempt 由宿主闭包重新取快照再封，
 * 重试复用已上传的参考（见 localizedInRetry），窗口里没有 I/O；
 * 只重试这一个码——素材身份变化（generation_reference_identity_changed）等真实变化照旧直接失败。
 */
export async function retryOnReferenceScopeChange<T>(attempt: () => Promise<T>): Promise<T> {
  return localizedInRetry.run(new Map(), () => retryAttempts(attempt));
}

/** 只活在一次 retryOnReferenceScopeChange 里：签名 URL 不会跨请求被复用。 */
const localizedInRetry = new AsyncLocalStorage<Map<string, readonly string[]>>();

async function retryAttempts<T>(attempt: () => Promise<T>): Promise<T> {
  for (let tried = 1; ; tried += 1) {
    try { return await attempt(); }
    catch (error) {
      if (tried >= SCOPE_RETRY_ATTEMPTS || !(error instanceof Error) || error.message !== SCOPE_CHANGED) throw error;
    }
  }
}
