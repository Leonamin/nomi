// Regression (2026-10-20 data loss): staging a new workflow must never delete a live registration.
// Supersede may only remove the orphaned shell of the SAME model's previous revision.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root = "";
const roots: string[] = [];
vi.mock("electron", () => ({
  app: { getPath: () => root, getAppPath: () => process.cwd() },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() },
}));

const T = "2026-10-01T00:00:00.000Z";
const ROOT = "comfyui-local";
const SRC = "adapterCandidateSourceVendorKey";
const ROOTK = "adapterCandidateRootVendorKey";
const REV = "adapterCandidateRevisionId";

type V = { key: string; enabled: boolean; meta?: Record<string, unknown> };
const vendor = (v: V) => ({
  name: "ComfyUI", hasApiKey: false, baseUrlHint: "http://127.0.0.1:8188", authType: "none",
  providerKind: "openai-compatible", createdAt: T, updatedAt: T, ...v,
});
const cand = (key: string, source: string, enabled: boolean, extra: Record<string, unknown> = {}): V => ({
  key, enabled, meta: { [SRC]: source, [ROOTK]: ROOT, [REV]: `rev-${key}`, ...extra },
});
const model = (vendorKey: string, modelKey: string, published: boolean) => ({
  vendorKey, modelKey, labelZh: modelKey, kind: "image", enabled: published, createdAt: T, updatedAt: T,
  meta: { adapter: published
    ? { state: "verified", activeRevision: "r1", modes: [{ taskKind: "text_to_image", state: "verified" }] }
    : { state: "unverified", modes: [] } },
});
const mapping = (vendorKey: string, modelKey: string, enabled: boolean) => ({
  vendorKey, modelKey, taskKind: "text_to_image", name: modelKey, enabled, requestMapping: {}, createdAt: T, updatedAt: T,
});
/** A published model + its enabled mapping. */
const live = (vendorKey: string, modelKey: string) => ({ m: model(vendorKey, modelKey, true), p: mapping(vendorKey, modelKey, true) });

function write(vendors: V[], pieces: Array<{ m: unknown; p: unknown }>): void {
  fs.writeFileSync(path.join(root, "model-catalog.json"), JSON.stringify({
    version: 5, vendors: vendors.map(vendor), models: pieces.map((x) => x.m), mappings: pieces.map((x) => x.p), apiKeysByVendor: {},
  }), "utf8");
}

const wf = (seed: number) => JSON.stringify({
  "2": { class_type: "CLIPTextEncode", inputs: { text: "x", clip: ["3", 0] } },
  "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "m.safetensors" } },
  "4": { class_type: "KSampler", inputs: { seed, positive: ["2", 0], model: ["3", 0] } },
  "5": { class_type: "SaveImage", inputs: { images: ["4", 0], filename_prefix: "t" } },
});
const binding = { promptNodeId: "2", promptInputKey: "text", outputNodeId: "5", outputKind: "image", params: [] };

async function load() {
  vi.resetModules();
  const store = await import("./comfyuiWorkflowImportStore");
  const cat = await import("./catalogStore");
  return { ...store, cat };
}
const keys = (c: { vendors: Array<{ key: string }> }) => c.vendors.map((v) => v.key);

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "nomi-supersede-")); roots.push(root); });
afterEach(() => { for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });

describe("workflow import never deletes live registrations", () => {
  it("(a) re-saved A leaves disabled v1 with live descendants; importing C keeps A v2 and B", async () => {
    const a1 = `${ROOT}--candidate-a1`, a2 = `${ROOT}--candidate-a2`, b = `${ROOT}--candidate-b`;
    write(
      [{ key: ROOT, enabled: false }, cand(a1, ROOT, false), cand(a2, a1, true), cand(b, a1, true)],
      [{ m: model(a1, "qwen", false), p: mapping(a1, "qwen", false) }, live(a2, "qwen"), live(b, "klein")],
    );
    const { importComfyWorkflowToCatalog, cat } = await load();
    const r = importComfyWorkflowToCatalog({ text: wf(1), binding, labelZh: "C", vendorKey: a2 }, "c");
    expect(r).toMatchObject({ ok: true });
    const s = cat.readCatalog();
    expect(keys(s)).toEqual(expect.arrayContaining([a1, a2, b]));
    expect(s.models.filter((m) => m.enabled).map((m) => m.modelKey).sort()).toEqual(["klein", "qwen"]);
    expect(s.mappings.filter((m) => m.enabled).map((m) => m.modelKey).sort()).toEqual(["klein", "qwen"]);
  });

  it("(b) three independent imports then a fourth keep all three; edges resolve to the root", async () => {
    write([{ key: ROOT, enabled: false }], []);
    const { importComfyWorkflowToCatalog, cat } = await load();
    const made: string[] = [];
    let newest = ROOT;
    for (const [i, label] of ["A", "B", "C", "D"].entries()) {
      const r = importComfyWorkflowToCatalog({ text: wf(i), binding, labelZh: label, vendorKey: newest }, label.toLowerCase()) as { vendorKey: string };
      made.push(r.vendorKey);
      newest = r.vendorKey; // the UI/certify path hands back the newest vendor
    }
    const s = cat.readCatalog();
    // staged-but-unpublished siblings of OTHER workflows are not this import's to supersede
    expect(keys(s)).toEqual(expect.arrayContaining(made));
    for (const v of made) expect((s.vendors.find((x) => x.key === v)!.meta as Record<string, unknown>)[SRC]).toBe(ROOT);
  });

  it("(c) re-saving a workflow replaces only its own old unpublished revision", async () => {
    write([{ key: ROOT, enabled: false }], []);
    const { importComfyWorkflowToCatalog, updateComfyWorkflowInCatalog, cat } = await load();
    const a = importComfyWorkflowToCatalog({ text: wf(1), binding, labelZh: "A" }, "a") as { vendorKey: string; modelKey: string };
    const b = importComfyWorkflowToCatalog({ text: wf(2), binding, labelZh: "B" }, "b") as { vendorKey: string };
    const a2 = updateComfyWorkflowInCatalog({ text: wf(3), binding, labelZh: "A", modelKey: a.modelKey }) as { vendorKey: string };
    const k = keys(cat.readCatalog());
    expect(k).not.toContain(a.vendorKey);
    expect(k).toEqual(expect.arrayContaining([b.vendorKey, a2.vendorKey]));
  });

  it("(e) existing chained shape (Ref2VA -> FL2VA -> root) survives another import", async () => {
    const fl = `${ROOT}--candidate-fl2va`, ref = `${ROOT}--candidate-ref2va`;
    write(
      [{ key: ROOT, enabled: false }, cand(fl, ROOT, true), cand(ref, fl, true)],
      [live(fl, "fl2va"), live(ref, "ref2va")],
    );
    const { importComfyWorkflowToCatalog, updateComfyWorkflowInCatalog, cat } = await load();
    importComfyWorkflowToCatalog({ text: wf(1), binding, labelZh: "New", vendorKey: ref }, "n");
    updateComfyWorkflowInCatalog({ text: wf(2), binding, labelZh: "FL", modelKey: "fl2va", vendorKey: ref });
    const s = cat.readCatalog();
    expect(keys(s)).toEqual(expect.arrayContaining([fl, ref]));
    expect(s.models.filter((m) => m.enabled).map((m) => m.modelKey).sort()).toEqual(["fl2va", "ref2va"]);
  });

  it("(d) class guard: a transactional delete refuses any closure that owns a published model (generic fixture)", async () => {
    const shell = "acme--candidate-shell", child = "acme--candidate-child";
    write(
      [{ key: "acme", enabled: false }, { key: "lonely", enabled: false }, cand(shell, "acme", false, { [ROOTK]: "acme" }), cand(child, shell, true, { [ROOTK]: "acme" })],
      [live(child, "m1")],
    );
    const { cat } = await load();
    expect(() => cat.mutateCatalog((tx) => tx.deleteVendor(shell))).toThrow(/published/);
    expect(keys(cat.readCatalog())).toEqual(expect.arrayContaining([shell, child]));
    expect(cat.readCatalog().models.some((m) => m.modelKey === "m1" && m.enabled)).toBe(true);
    // an unpublished, dependency-free shell is still deletable
    cat.mutateCatalog((tx) => tx.deleteVendor("lonely"));
    expect(keys(cat.readCatalog())).not.toContain("lonely");
  });
});
