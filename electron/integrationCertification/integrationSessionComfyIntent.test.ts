// 2026-10-20 事故：无编辑「工作流设置 → 保存」(带 modelKey) 留下一个未终结会话，随后的「自定义工作流导入」
// (不带 modelKey) 复用了它，被当成对该模型的「更新」，覆盖了已有注册。会话的意图必须来自**当次请求**。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

process.env.NOMI_CAPABILITY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nomi-comfy-intent-cap-"));
import { IntegrationSessionService } from "./integrationSession";

const BASE = "http://127.0.0.1:8188";
type Seen = { modelKey?: string; name?: string };

function make(filePath?: string) {
  const seen: Seen[] = [];
  const file = filePath || path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nomi-comfy-intent-")), "sessions.json");
  const certifyComfy = vi.fn(async (session: { id: string; config: Seen }) => {
    seen.push({ modelKey: session.config.modelKey, name: session.config.name });
    return { runId: `run-${seen.length}`, revisionDigest: "d".repeat(64) };
  });
  const service = new IntegrationSessionService({
    filePath: file,
    save: (target, state) => fs.writeFileSync(target, JSON.stringify(state)),
    certifyComfy: certifyComfy as never,
  });
  // 与 comfyui:prepare 一致：begin → submitWorkflow → resolveInput。
  const prepare = (name: string, modelKey?: string, workflow = "wf") => {
    const created = service.begin({ kind: "comfyui-workflow", name, baseUrl: BASE }, "nomi");
    const submitted = service.submitWorkflow(created.id, created.revision, "nomi", workflow, undefined, {
      name,
      ...(modelKey ? { modelKey } : {}),
    });
    return service.resolveInput(submitted.id, submitted.revision, "nomi", {});
  };
  return { service, seen, file, prepare };
}

describe("ComfyUI session intent comes from the current request", () => {
  it("keyless import after a modelKey Save (same endpoint) imports new: no stale modelKey, new name", async () => {
    const { service, seen, prepare } = make();
    const saved = prepare("MiniMax H3 FL2VA", "FL2VA");
    const imported = prepare("Z-Image", undefined, "wf2");
    expect(imported.id).toBe(saved.id); // 会话仍可复用（resume 语义不变）
    await service.start(imported.id, imported.revision, "nomi", "k1");
    expect(seen).toEqual([{ modelKey: undefined, name: "Z-Image" }]);
  });

  it("two intents on one endpoint never cross", async () => {
    const { service, seen, prepare } = make();
    const a = prepare("A", undefined);
    const b = prepare("B", "X");
    expect(b.id).toBe(a.id);
    const c = prepare("C", undefined);
    await service.start(c.id, c.revision, "nomi", "k2");
    expect(seen).toEqual([{ modelKey: undefined, name: "C" }]);
  });

  it("an already-persisted session carrying a stale modelKey cannot turn a keyless import into an update", async () => {
    const first = make();
    const stale = first.prepare("Saved", "FL2VA");
    const raw = JSON.parse(fs.readFileSync(first.file, "utf8"));
    expect(raw.sessions[0].config.modelKey).toBe("FL2VA"); // 旧版本留下的盘上形态
    const reloaded = make(first.file); // 重启后的宿主
    const imported = reloaded.prepare("Z-Image", undefined, "wf2");
    expect(imported.id).toBe(stale.id);
    await reloaded.service.start(imported.id, imported.revision, "nomi", "k4");
    expect(reloaded.seen).toEqual([{ modelKey: undefined, name: "Z-Image" }]);
  });

  it("same intent resumed after a reload still updates the right model; Save with edits keeps its key", async () => {
    const first = make();
    first.prepare("FL2VA", "FL2VA");
    const reloaded = make(first.file);
    const again = reloaded.prepare("FL2VA edited", "FL2VA", "wf-edit");
    await reloaded.service.start(again.id, again.revision, "nomi", "k5");
    expect(reloaded.seen).toEqual([{ modelKey: "FL2VA", name: "FL2VA edited" }]);
  });
});
