import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OperationLedger } from "./operationLedger";
import { certificationModeOperationKey } from "./modeIdentity";
import { neverAcceptedComfySubmission, settleComfyOperationAfterFailure } from "./comfyUnsettledOperation";

const roots: string[] = [];

function ledger() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nomi-comfy-unsettled-"));
  roots.push(root);
  const filePath = path.join(root, "private", "operations.json");
  return { filePath, ledger: new OperationLedger(filePath) };
}

function beginInput(overrides: Record<string, unknown> = {}) {
  const runId = typeof overrides.runId === "string" ? overrides.runId : "run-1";
  return {
    runId,
    contractDigest: "a".repeat(64),
    idempotencyKey: "integration-user-confirmation-1",
    lineageRootVendorKey: "comfyui-local",
    leaseOwner: runId,
    leaseToken: "lease-1",
    attempt: 1,
    childRunRef: { runId, revisionDigest: "a".repeat(64) },
    now: "2026-10-13T00:00:00.000Z",
    ...overrides,
  } as const;
}

const modeKey = certificationModeOperationKey("comfy-sd15-image", "text_to_image", 1);

function markSubmitting(store: OperationLedger, revision = 1) {
  return store.markSubmitting("run-1", {
    operationKey: modeKey,
    modelKey: "comfy-sd15-image",
    taskKind: "text_to_image",
    attempt: 1,
    providerIdempotency: "unsupported",
    expectedRevision: revision,
    now: "2026-10-13T00:00:01.000Z",
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("settleComfyOperationAfterFailure", () => {
  // 2026-10-13 개인 웹 실측 회귀: ComfyUI 가 create 를 동기적으로 거부(HTTP 400)하면 원장이
  // `submission_unknown` 으로 남고, 그 상태에서 나가는 전이가 없어 **그 계열의 재인증이 영구히
  // 막혔다**(실제로 잠겼고 손으로 원장을 고쳐야 풀렸다). remote id 가 없으면 대조할 것도 없다.
  it("provider 가 수락하기 전에 끝난 create 를 실패 종결로 적고, 같은 계열 재인증을 막지 않는다", () => {
    const { ledger: store, filePath } = ledger();
    store.begin(beginInput());
    markSubmitting(store);

    // 회귀 증거: 종결 없이는 같은 계열을 다시 시작할 수 없다.
    expect(() => store.begin(beginInput({ runId: "run-2", idempotencyKey: "integration-user-confirmation-2" })))
      .toThrowError(/unresolved remote submission/i);

    const current = store.getByRunId("run-1");
    expect(current).toBeDefined();
    expect(neverAcceptedComfySubmission(current!)).toBe(true);
    settleComfyOperationAfterFailure({
      ledger: store,
      runId: "run-1",
      operation: current!,
      reasonCode: "provider_failed",
      now: "2026-10-13T00:00:02.000Z",
    });

    expect(new OperationLedger(filePath).getByRunId("run-1")).toMatchObject({
      checkpoint: "settled",
      submissionState: "settled",
      settledResult: { ok: false, taskKind: "text_to_image", stage: "contract", reasonCode: "provider_failed" },
    });

    const restarted = store.begin(beginInput({
      runId: "run-2",
      contractDigest: "b".repeat(64),
      idempotencyKey: "integration-user-confirmation-2",
      childRunRef: { runId: "run-2", revisionDigest: "b".repeat(64) },
    }));
    expect(restarted.status).toBe("created");
  });

  it("수락된(remote id 가 있는) 작업은 대조 대기로 남긴다 — 종결로 적으면 중복 제출이 열린다", () => {
    const { ledger: store, filePath } = ledger();
    store.begin(beginInput());
    markSubmitting(store);
    store.markSubmitted("run-1", {
      remoteTaskId: "remote-accepted-1",
      expectedRevision: 2,
      now: "2026-10-13T00:00:01.500Z",
    });

    const current = store.getByRunId("run-1");
    expect(neverAcceptedComfySubmission(current!)).toBe(false);
    settleComfyOperationAfterFailure({
      ledger: store,
      runId: "run-1",
      operation: current!,
      now: "2026-10-13T00:00:02.000Z",
    });

    expect(new OperationLedger(filePath).getByRunId("run-1")).toMatchObject({
      checkpoint: "submission_unknown",
      submissionState: "unknown",
      userAction: "reconcile_or_contact_provider",
      remoteTaskId: "remote-accepted-1",
    });
  });
});
