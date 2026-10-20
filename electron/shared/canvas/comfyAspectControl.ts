// ComfyUI 比例控件与尺寸规格——渲染层（节点控件）与主进程（出图尺寸决策）共用的中立契约，不含 IO。
import { ASPECT_OPTIONS } from "../storyboard/storyboardShotScope";
import { isJsonRecord } from "../../jsonUtils";

/** 声明给画布/规划器的比例控件键（与分镜整片比例同名，落画布才认得）。 */
export const COMFY_ASPECT_CONTROL_KEY = "aspect_ratio";
export const COMFY_ASPECT_AUTO = "auto";

/** 比例控件：default=auto 表示"沿用 workflow 自带尺寸"。导入与内置文生图共用这一份。 */
export const COMFY_ASPECT_CONTROL = {
  key: COMFY_ASPECT_CONTROL_KEY, label: "画面比例", type: "select" as const, default: COMFY_ASPECT_AUTO,
  options: [COMFY_ASPECT_AUTO, ...ASPECT_OPTIONS],
};

export type ComfySizeSpec = { widthKey: string; heightKey: string; defaultWidth: number; defaultHeight: number; budget: number };

/** 画布（渲染进程）随请求带来的项目画幅；aspect 为 auto 时它就是默认比例。 */
export const COMFY_PROJECT_ASPECT_KEY = "projectAspectRatio";

/** 从模型登记里读出尺寸控件键与像素预算。没有成对的 width/height 控件 → null（该模型出图尺寸不由字面数字决定，如 Klein 跟参考图）。 */
export function comfySizeSpec(model: { meta?: unknown }): ComfySizeSpec | null {
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

