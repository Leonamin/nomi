// ComfyUI 工作流的出图尺寸跟随比例（画幅）——登记过的 workflow 把 width/height 当字面数字绑成 comfy_width/comfy_height，
// 默认值是作者写死的方图（1024²/640²），而分镜/节点/Agent 给的 aspect_ratio 在这条链上无处落脚：
// 档案里没有同名控件 → 落画布"诚实缺席"，extras 里的 aspect_ratio 模板不引用 → 被丢弃。结果整片出方图（2026-10-20 实测）。
//
// 本层是 runTask 里的单一出口：把"比例（或 i2v 的首帧比例）"换算成 workflow 自己的像素预算下的 W×H，写进
// comfy_width/comfy_height。像素预算 = workflow 控件的默认 W×H（作者按自己的显卡定的），不另编一个常量。
import { parseAspect } from "./paramTranslate";
import { ASPECT_OPTIONS } from "../shared/storyboard/storyboardShotScope";
import type { Model } from "./types";
import { isJsonRecord, type JsonRecord } from "../jsonUtils";

/** 声明给画布/规划器的比例控件键（与分镜整片比例同名，落画布才认得）。 */
export const COMFY_ASPECT_CONTROL_KEY = "aspect_ratio";
export const COMFY_ASPECT_AUTO = "auto";

/** 比例控件：default=auto 表示"沿用 workflow 自带尺寸"。导入与内置文生图共用这一份。 */
export const COMFY_ASPECT_CONTROL = {
  key: COMFY_ASPECT_CONTROL_KEY, label: "画面比例", type: "select" as const, default: COMFY_ASPECT_AUTO,
  options: [COMFY_ASPECT_AUTO, ...ASPECT_OPTIONS],
};

const STEP = 16; // Wan / Flux / Qwen 的潜空间要求 16 的倍数；SD 系 8 的倍数亦满足
const MIN_EDGE = 64;
const MAX_RATIO = 4; // 超过 4:1 的极端条幅在这些模型上不可用，按"不认识"处理

export type ComfySizeSpec = { widthKey: string; heightKey: string; defaultWidth: number; defaultHeight: number; budget: number };

/** 画布（渲染进程）随请求带来的项目画幅；aspect 为 auto 时它就是默认比例。 */
export const COMFY_PROJECT_ASPECT_KEY = "projectAspectRatio";

/** 从模型登记里读出尺寸控件键与像素预算。没有成对的 width/height 控件 → null（该模型出图尺寸不由字面数字决定，如 Klein 跟参考图）。 */
export function comfySizeSpec(model: Pick<Model, "meta">): ComfySizeSpec | null {
  const meta = isJsonRecord(model.meta) ? model.meta : {};
  const draft = isJsonRecord(meta.comfyWorkflowImport) ? meta.comfyWorkflowImport : {};
  const binding = isJsonRecord(draft.binding) ? draft.binding : {};
  const bound = Array.isArray(binding.params) ? binding.params.filter(isJsonRecord) : [];
  const keyOf = (inputKey: string, fallback: string): string => {
    const hit = bound.find((p) => p.inputKey === inputKey && typeof p.paramKey === "string");
    return hit ? String(hit.paramKey) : fallback;
  };
  const widthKey = keyOf("width", "comfy_width");
  const heightKey = keyOf("height", "comfy_height");
  const controls = Array.isArray(meta.parameters) ? meta.parameters.filter(isJsonRecord) : [];
  const defaultOf = (key: string): number | null => {
    const v = controls.find((c) => c.key === key)?.default;
    return typeof v === "number" && v > 0 ? v : null;
  };
  const w = defaultOf(widthKey), h = defaultOf(heightKey);
  return w && h ? { widthKey, heightKey, defaultWidth: w, defaultHeight: h, budget: w * h } : null;
}

/** 比例 + 像素预算 → 16 倍数的 [W,H]；比例不可用 → null。 */
export function fitSizeToAspect(aspect: string | undefined, budget: number): [number, number] | null {
  const ab = parseAspect(String(aspect ?? "").replace(/\s*[（(][^）)]*[）)]$/, ""));
  if (!ab) return null;
  const ratio = ab[0] / ab[1];
  if (!(ratio <= MAX_RATIO && ratio >= 1 / MAX_RATIO)) return null;
  const snap = (n: number) => Math.max(MIN_EDGE, Math.round(n / STEP) * STEP);
  return [snap(Math.sqrt(budget * ratio)), snap(Math.sqrt(budget / ratio))];
}

// ── 首帧尺寸（i2v 跟随输入图比例）：只读文件头，不解码 ─────────────────────────
export function imageSizeFromHeader(b: Uint8Array): [number, number] | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length >= 24 && ascii(1, 3) === "PNG") return [dv.getUint32(16), dv.getUint32(20)];
  if (b.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const kind = ascii(12, 4);
    if (kind === "VP8X") return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
    if (kind === "VP8L") { const bits = dv.getUint32(21, true); return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]; }
    if (kind === "VP8 ") return [dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff];
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let o = 2; o + 9 < b.length;) {
      if (b[o] !== 0xff) { o += 1; continue; }
      const marker = b[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [dv.getUint16(o + 7), dv.getUint16(o + 5)];
      o += 2 + dv.getUint16(o + 2);
    }
  }
  return null;
}

export type ComfyAspectOutcome = { patch: JsonRecord; warning?: string };

/**
 * 纯决策：extras（pre-defaults）+ 尺寸规格 + 首帧尺寸 → 要补写的 comfy_width/comfy_height。
 * 优先级：用户改过的像素（≠控件默认值）> 显式非 auto 比例 > 首帧比例（i2v 输出必须跟输入图）> 项目画幅 > 不动（workflow 自带尺寸）。
 * 画布节点会把每个控件的默认值落进 extras，所以"成对像素"只有在不等于默认值时才算用户的选择；等于默认值 = 没碰过。
 * 比例写了但认不出 → 往下一级退，并带 warning（调用方负责打出来，不静默当方图）。
 */
export function decideComfyOutputSize(extras: JsonRecord, spec: ComfySizeSpec, refSize: [number, number] | null): ComfyAspectOutcome {
  const num = (key: string) => (extras[key] === undefined || extras[key] === null || extras[key] === "" ? null : Number(extras[key]));
  const w = num(spec.widthKey), h = num(spec.heightKey);
  if (w !== null && h !== null && (w !== spec.defaultWidth || h !== spec.defaultHeight)) return { patch: {} };
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const explicit = [extras[COMFY_ASPECT_CONTROL_KEY], extras.aspectRatio].map(text).find(Boolean);
  const wanted = explicit && explicit.toLowerCase() !== COMFY_ASPECT_AUTO ? explicit : undefined;
  const project = text(extras[COMFY_PROJECT_ASPECT_KEY]);
  const warnings: string[] = [];
  const fit = (aspect: string | undefined, label: string) => {
    if (!aspect) return null;
    const dims = fitSizeToAspect(aspect, spec.budget);
    if (!dims) warnings.push(`${label} "${aspect}" is not a usable W:H ratio`);
    return dims;
  };
  const dims = fit(wanted, "aspect")
    ?? (refSize ? fitSizeToAspect(`${refSize[0]}:${refSize[1]}`, spec.budget) : null)
    ?? fit(project, "project aspect");
  return { patch: dims ? { [spec.widthKey]: dims[0], [spec.heightKey]: dims[1] } : {}, ...(warnings.length ? { warning: warnings.join("; ") } : {}) };
}

/** 该模型登记的第一个图片输入槽里，调用方这次递进来的值（i2v 首帧）。 */
export function firstImageRef(model: Pick<Model, "meta">, extras: JsonRecord): string | null {
  const meta = isJsonRecord(model.meta) ? model.meta : {};
  const controls = Array.isArray(meta.parameters) ? meta.parameters.filter(isJsonRecord) : [];
  for (const control of controls) {
    if (control.type !== "image-url" || (control.mediaKind ?? "image") !== "image" || typeof control.key !== "string") continue;
    const value = extras[control.key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
