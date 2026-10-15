import { describe, expect, it, vi } from "vitest";
import { getDesktopBridge } from "../../desktop/bridge";
import {
  filePathsFromDrop,
  importDroppedFilesToLibrary,
  importLocalPathsToLibrary,
  isTextEditingTarget,
} from "./assetLibraryLocalImport";

vi.mock("../../desktop/bridge", () => ({ getDesktopBridge: vi.fn() }));

const mockedGetDesktopBridge = vi.mocked(getDesktopBridge);

describe("assetLibraryLocalImport", () => {
  it("extracts unique absolute paths from dropped Electron files", () => {
    const files = [
      { path: "/tmp/a.png" },
      { path: "/tmp/a.png" },
      { path: "relative.jpg" },
      { name: "missing-path.png" },
    ] as unknown as File[];

    expect(filePathsFromDrop(files)).toEqual(["/tmp/a.png"]);
  });

  it("uses the Electron webUtils resolver when File.path is unavailable", () => {
    const file = { name: "a.png" } as unknown as File;

    expect(filePathsFromDrop([file], () => "/Users/test/a.png")).toEqual(["/Users/test/a.png"]);
  });

  it("falls back to File.path when Electron returns an empty native path", () => {
    const file = { name: "a.png", path: "/Users/test/a.png" } as unknown as File;

    expect(filePathsFromDrop([file], () => "")).toEqual(["/Users/test/a.png"]);
  });

  it("does not treat an editing target as the asset library paste surface", () => {
    expect(isTextEditingTarget({ closest: () => ({}) } as unknown as EventTarget)).toBe(true);
    expect(isTextEditingTarget({ closest: () => null } as unknown as EventTarget)).toBe(false);
    expect(isTextEditingTarget(null)).toBe(false);
  });

  it("uses the desktop copy bridge and returns its batch result", async () => {
    const rejection = { reason: "no-disk-space", fileBytes: 2, freeBytes: 1, neededBytes: 3 } as const;
    const copyFiles = vi.fn(async () => ({ created: [{ id: "asset-1" }], rejected: [{ fileName: "big.mov", rejection }], failedCount: 0 }));
    mockedGetDesktopBridge.mockReturnValue({ assets: { copyFiles } } as never);

    await expect(importLocalPathsToLibrary("project-1", ["/tmp/a.png"])).resolves.toEqual({
      created: [{ id: "asset-1" }],
      rejected: [{ fileName: "big.mov", rejection }],
      failedCount: 0,
    });
    expect(copyFiles).toHaveBeenCalledWith({ projectId: "project-1", paths: ["/tmp/a.png"] });
  });

  it("imports a browser File without a native path through the existing byte bridge", async () => {
    const file = new File(["image bytes"], "camera.png", { type: "image/png" });
    const imported = { id: "asset-web" };
    const importNativeFile = vi.fn(async () => ({ ok: true as const, asset: imported }));
    const copyFiles = vi.fn();
    mockedGetDesktopBridge.mockReturnValue({ platform: "web", assets: { importNativeFile, copyFiles } } as never);

    await expect(importDroppedFilesToLibrary("project-web", [file])).resolves.toEqual({
      created: [imported], rejected: [], failedCount: 0,
    });
    expect(importNativeFile).toHaveBeenCalledWith(file, {
      projectId: "project-web", fileName: "camera.png", contentType: "image/png", kind: "upload",
    });
    expect(copyFiles).not.toHaveBeenCalled();
  });

  it("keeps multiple browser files in the original project and counts a failed import", async () => {
    const files = [new File(["a"], "a.png"), new File(["b"], "b.wav")];
    const importNativeFile = vi.fn()
      .mockResolvedValueOnce({ ok: true, asset: { id: "a" } })
      .mockResolvedValueOnce({ ok: false, failure: { code: "capability_execution_failed", reason: "import-failed" } });
    mockedGetDesktopBridge.mockReturnValue({ platform: "web", assets: { importNativeFile } } as never);

    await expect(importDroppedFilesToLibrary("project-a", files)).resolves.toEqual({
      created: [{ id: "a" }], rejected: [], failedCount: 1,
    });
    expect(importNativeFile.mock.calls.map(([, payload]) => payload.projectId)).toEqual(["project-a", "project-a"]);
  });

  it("keeps Electron drops on native path batch copy", async () => {
    const files = [{ name: "a.png", path: "/tmp/a.png" }, { name: "b.wav", path: "/tmp/b.wav" }] as unknown as File[];
    const result = { created: [{ id: "a" }], rejected: [], failedCount: 0 };
    const copyFiles = vi.fn(async () => result);
    const importNativeFile = vi.fn();
    mockedGetDesktopBridge.mockReturnValue({ platform: "electron", assets: { copyFiles, importNativeFile } } as never);

    await expect(importDroppedFilesToLibrary("project-desktop", files)).resolves.toBe(result);
    expect(copyFiles).toHaveBeenCalledWith({ projectId: "project-desktop", paths: ["/tmp/a.png", "/tmp/b.wav"] });
    expect(importNativeFile).not.toHaveBeenCalled();
  });
});
