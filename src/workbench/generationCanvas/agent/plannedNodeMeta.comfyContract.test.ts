import { describe, expect, it } from "vitest";
import { buildModelEntryIndex, buildPlannedNodeMeta } from "./plannedNodeMeta";
import { buildAgentModelEntries } from "./availableModels";
import type { ModelOption } from "../../../config/models";
import { requiredModeForGenerationNode } from "../adapters/modelOptionsAdapter";
import { projectSpendNode } from "../../ai/v4/spendCardDraft";
import { applySpendReferences, pendingReferenceInputs, referenceInputsFromNode } from "../../ai/v4/spendCardReferences";
import type { PendingSpendShot } from "../../../desktop/productionRunBridgeTypes";

// 导入的 ComfyUI 自定义工作流：能力合同 + 显式 image-url 参数。agent 落的节点必须与用户手选同模型得到同一份 meta。
const VENDOR = "comfyui-local--candidate-58dbbbabe116bbb8";
function option(kind: "image" | "video", slotKind: "first_frame", modeId: string, task: string, key: string): ModelOption {
  return {
    value: `comfy-${kind}`, modelKey: `comfy-${kind}`, label: `Comfy ${kind}`, vendor: VENDOR, kind,
    meta: {
      customCapabilityContract: {
        version: 1, kind, defaultModeId: modeId, transportTaskKind: task,
        modes: [{ id: modeId, intent: "edit", vendorTerm: modeId, hint: "", promptRequired: true, transportTaskKind: task,
          slots: [{ kind: slotKind, label: "First frame", min: 1, max: 1, inputKey: key }],
          params: [{ key: "comfy_steps", label: "Steps", type: "number", options: [], defaultValue: 20 }] }],
      },
      parameters: [
        { key: key, label: "First frame", type: "image-url", mediaKind: "image" },
        { key: "comfy_steps", label: "Steps", type: "number", defaultValue: 20 },
      ],
    },
  } as ModelOption;
}

describe.each([
  ["image", "image_edit", "first_frame_url"],
  ["video", "image_to_video", "first_frame_url"],
] as const)("ComfyUI 自定义合同 %s 模型落画布", (kind, task, key) => {
  const opt = option(kind, "first_frame", task, task, key);
  const index = buildModelEntryIndex(buildAgentModelEntries([opt]));

  it("planned meta 带合同与参考槽声明，任务类型解析为合同里的 " + task, () => {
    const meta = buildPlannedNodeMeta({ modelKey: opt.modelKey!, vendor: VENDOR }, index)!;
    expect(meta.customCapabilityContract).toBeTruthy();
    expect(meta.parameterReferenceSlots).toMatchObject({ slots: [{ key }] });
    expect(meta.comfy_steps).toBe(20);
    const node = { id: "n", kind, title: "", position: { x: 0, y: 0 }, prompt: "p", meta };
    expect(requiredModeForGenerationNode(node as never)).toBe(task);
  });

  it("花费卡解析出任务类型与参考槽，first_frame 参考原样进、原样发", () => {
    const shot: PendingSpendShot = { shotId: "s", index: 1, kind, mode: task, modeId: task, providerId: VENDOR, modelId: opt.modelKey!, prompt: "p", parameters: {}, price: { known: false },
      references: [{ assetId: "a", contentHash: "h", version: 1, kind: "image", role: "first_frame", url: "nomi-local://asset/p/a.png" }] };
    const node = projectSpendNode(shot, undefined, opt)!;
    expect(requiredModeForGenerationNode(node as never)).toBe(task);
    const shown = applySpendReferences(node, pendingReferenceInputs(shot));
    expect(shown.meta?.parameterReferenceSlots).toMatchObject({ slots: [{ key, group: "first_frame" }] });
    expect(shown.meta?.firstFrameUrl).toBe("nomi-local://asset/p/a.png");
    expect(referenceInputsFromNode(shown, shot)).toEqual(pendingReferenceInputs(shot));
  });
});
