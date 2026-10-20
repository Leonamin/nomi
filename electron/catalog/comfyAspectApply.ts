// comfyAspectSize 的 IO 一半：读首帧字节、打警告、给 runTask 一个出口。纯决策与控件常量在 comfyAspectSize（叶子模块，目录种子可安全引用）。
import { readNomiLocalAsset } from "../assets/localAssetFile";
import { hardenedFetch } from "../hardenedFetch";
import { normalizeComfyuiBaseUrl } from "../comfyui/endpointResolver";
import { logWarn } from "../logging/logger";
import { comfySizeSpec, decideComfyOutputSize, firstImageRef, imageSizeFromHeader } from "./comfyAspectSize";
import type { Model } from "./types";
import type { JsonRecord } from "../jsonUtils";

export type ComfyRefReader = (ref: string) => Promise<Uint8Array | null>;

/** 默认读取：nomi-local 读本地字节、data: 解码、其余当 ComfyUI input 文件名走它自己的 /view（生产路径的参考已是 input 名）。读不到 → null，不抛。 */
export function defaultComfyRefReader(baseUrl: string): ComfyRefReader {
  return async (ref) => {
    try {
      if (ref.startsWith("nomi-local://")) return readNomiLocalAsset(ref)?.bytes ?? null;
      const data = ref.match(/^data:[^,]*;base64,(.*)$/s);
      if (data) return Buffer.from(data[1], "base64");
      if (/^[a-z]+:\/\//i.test(ref) || !baseUrl) return null;
      const slash = ref.lastIndexOf("/");
      const query = new URLSearchParams({ filename: ref.slice(slash + 1), subfolder: slash > 0 ? ref.slice(0, slash) : "", type: "input" });
      const base = normalizeComfyuiBaseUrl(baseUrl);
      // 只信已配置的那台 ComfyUI（精确同源的私网例外），与产物回收同口径。
      const res = await hardenedFetch(`${base}/view?${query}`, { timeoutMs: 8000, maxBytes: 64 * 1024 * 1024, allowedPrivateOrigins: [new URL(base).origin] });
      return new Uint8Array(res.bytes);
    } catch { return null; }
  };
}

/** runTask 的单一出口：在档案默认值合并之前，把比例/首帧比例落成 comfy_width/comfy_height。无关模型原样返回。 */
export async function applyComfyOutputSize(
  extras: JsonRecord | undefined, model: Pick<Model, "meta" | "modelKey">, baseUrl: string, read: ComfyRefReader = defaultComfyRefReader(baseUrl),
): Promise<JsonRecord | undefined> {
  const spec = extras ? comfySizeSpec(model) : null;
  if (!extras || !spec) return extras;
  const ref = firstImageRef(model, extras);
  const bytes = ref ? await read(ref) : null;
  const { patch, warning } = decideComfyOutputSize(extras, spec, bytes ? imageSizeFromHeader(bytes) : null);
  if (warning) logWarn("tasks", "aspect-ratio-unusable", { modelKey: model.modelKey, detail: warning });
  return Object.keys(patch).length ? { ...extras, ...patch } : extras;
}
