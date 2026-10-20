import { describe, expect, it, vi } from "vitest";
import { applyComfyOutputSize } from "./comfyAspectApply";
import { decideComfyOutputSize, fitSizeToAspect, imageSizeFromHeader, type ComfySizeSpec } from "./comfyAspectSize";
import { analyzeComfyWorkflow, buildImportedWorkflow, parseComfyApiWorkflow } from "./comfyuiWorkflowImport";
import { WAN22_I2V_PRESET } from "./comfyuiPresets";
import { COMFYUI_CURATED_MODELS } from "./comfyuiLocal";
import { readFileSync } from "node:fs";

const SPEC_1K: ComfySizeSpec = { widthKey: "comfy_width", heightKey: "comfy_height", budget: 1024 * 1024 };
const png = (w: number, h: number) => {
  const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return b;
};

describe("fitSizeToAspect", () => {
  it.each([["16:9", [1360, 768]], ["9:16", [768, 1360]], ["1:1", [1024, 1024]], ["4:3", [1184, 880]], ["3:4", [880, 1184]], ["16:9 (横屏)", [1360, 768]]])("%s -> %j", (ratio, dims) => {
    const got = fitSizeToAspect(ratio, SPEC_1K.budget)!;
    expect(got).toEqual(dims);
    expect(got.every((n) => n % 16 === 0)).toBe(true);
    expect(got[0] * got[1]).toBeLessThanOrEqual(SPEC_1K.budget * 1.06);
  });
  it.each(["", "auto", "banana", "0:5", "100:1"])("unusable %j -> null", (r) => expect(fitSizeToAspect(r, 1e6)).toBeNull());
});

describe("decideComfyOutputSize", () => {
  it("t2i 16:9 and 9:16 get correctly shaped sizes", () => {
    expect(decideComfyOutputSize({ aspect_ratio: "16:9" }, SPEC_1K, null).patch).toEqual({ comfy_width: 1360, comfy_height: 768 });
    expect(decideComfyOutputSize({ aspect_ratio: "9:16" }, SPEC_1K, null).patch).toEqual({ comfy_width: 768, comfy_height: 1360 });
  });
  it("i2v keeps the input image aspect when no ratio is given", () => {
    const spec = { ...SPEC_1K, budget: 640 * 640 };
    expect(decideComfyOutputSize({}, spec, [1920, 1080]).patch).toEqual({ comfy_width: 848, comfy_height: 480 });
    expect(decideComfyOutputSize({ aspect_ratio: "auto" }, spec, [1080, 1920]).patch).toEqual({ comfy_width: 480, comfy_height: 848 });
  });
  it("explicit pixels win; auto/no source leaves the workflow size alone", () => {
    expect(decideComfyOutputSize({ aspect_ratio: "16:9", comfy_width: 512, comfy_height: 512 }, SPEC_1K, null).patch).toEqual({});
    expect(decideComfyOutputSize({ aspect_ratio: "auto" }, SPEC_1K, null)).toEqual({ patch: {} });
  });
  it("unknown ratio falls back visibly: warning, never a silent square-by-accident", () => {
    const r = decideComfyOutputSize({ aspect_ratio: "banana" }, SPEC_1K, null);
    expect(r.patch).toEqual({});
    expect(r.warning).toContain("banana");
    expect(decideComfyOutputSize({ aspect_ratio: "banana" }, SPEC_1K, [1920, 1080]).patch).toEqual({ comfy_width: 1360, comfy_height: 768 });
  });
});

describe("imageSizeFromHeader", () => {
  it("reads PNG", () => expect(imageSizeFromHeader(png(1920, 1080))).toEqual([1920, 1080]));
  it("reads JPEG SOF0", () => {
    const b = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0x04, 0x38, 0x07, 0x80, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(imageSizeFromHeader(b)).toEqual([1920, 1080]);
  });
  it("garbage -> null", () => expect(imageSizeFromHeader(new Uint8Array(40))).toBeNull());
});

describe("registration + runtime wiring", () => {
  const wan = () => {
    const graph = parseComfyApiWorkflow(readFileSync("docs/comfyui-workflows/wan22-i2v.api.json", "utf8"));
    return buildImportedWorkflow(graph, analyzeComfyWorkflow(graph).suggested);
  };
  it("a workflow with literal width+height declares the aspect_ratio control; the preset and curated txt2img too", () => {
    const controls = [wan().parameters, JSON.parse(JSON.stringify(COMFYUI_CURATED_MODELS[0].meta.parameters)), buildImportedWorkflow(parseComfyApiWorkflow(WAN22_I2V_PRESET.workflowText), WAN22_I2V_PRESET.binding).parameters];
    for (const list of controls) expect(list.find((c: { key: string }) => c.key === "aspect_ratio")).toMatchObject({ type: "select", default: "auto" });
  });
  it("applyComfyOutputSize: i2v follows the first-frame image through the reader; unrelated models untouched", async () => {
    const model = { modelKey: "wan", meta: { parameters: [
      { key: "comfy_width", type: "number", default: 640 }, { key: "comfy_height", type: "number", default: 640 },
      { key: "first_frame_url", type: "image-url", mediaKind: "image", default: "" }] } };
    const out = await applyComfyOutputSize({ first_frame_url: "frame.png" }, model, "http://x", async () => png(1920, 1080));
    expect(out).toMatchObject({ comfy_width: 848, comfy_height: 480 });
    const klein = { modelKey: "k", meta: { parameters: [{ key: "first_frame_url", type: "image-url", default: "" }] } };
    const same = { aspect_ratio: "16:9" };
    expect(await applyComfyOutputSize(same, klein, "http://x", vi.fn())).toBe(same);
  });
});
