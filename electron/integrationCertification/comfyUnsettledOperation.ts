// 실패한 ComfyUI 자체 점검이 끝난 자리에서, 그 계열의 원장을 어떻게 닫을지 **한 곳에서** 정한다.
//
// 왜 별도 모듈인가(규칙 12): `integrationSession.ts` 는 1394줄 棘轮이 걸린 巨壳이고,
// `operationLedger.ts` 는 800줄 하드 상한에 딱 붙어 있다. 판단을 그 두 파일 안에 두면 둘 중 하나가
// 반드시 넘친다(실제로 그렇게 빨간불이 났고, 그래서 결정만 여기로 옮겼다 — 두 파일은 한 줄로 부른다).
//
// 2026-10-13 개인 웹 실측: ComfyUI `/prompt` 처럼 **동기 수락/거부**인 wire 에서 create 가
// 거부(4xx)되거나 발송 전에 실패(정책·검증)하면 원장은 `submitting` 으로 남는다. 그때 `markUnknown`
// 을 부르면 `submission_unknown` 이 되는데, 그 상태에서 나가는 정식 전이가 하나도 없다 —
// `markSettled` 는 submitting|submitted 만, `cancel` 은 submitting|submitted|unknown 이 하나라도
// 있으면 거부, `markReconciled` 는 remote id 를 요구한다. 결과는 그 계열의 재인증 **영구 차단**이다
// (실측: 잘못된 워크플로 하나로 그 집이 잠겼고, 손으로 원장을 고쳐야 풀렸다).
//
// 그래서 **remote id 가 없을 때**(provider 가 수락했다는 증거 자체가 없을 때)는 `unknown` 이 아니라
// **실패 종결**로 적는다. remote id 가 있으면 `/history` 로 대조해야 하므로 `markUnknown` 이 정답이다.
// 남는 위험을 정직하게 적어 둔다: 발송 도중 프로세스가 죽어 provider 는 수락했는데 우리가 id 를 받지
// 못한 경우, 다음 시도가 한 번 중복 제출될 수 있다(ComfyUI 자기 점검 1회). id 가 없으면 대조할 방법
// 자체가 없다는 것이 이 선택의 근거이고, 영구 교착보다 낫다.
import type { OperationLedger } from "./operationLedger";
import type { CertificationOperationRecord } from "./types";

/** provider 가 create 를 수락하기 전에 끝난 것이 확정인가 — remote id 가 없으면 대조할 것도 없다. */
export function neverAcceptedComfySubmission(
  operation: Pick<CertificationOperationRecord, "submissionState" | "remoteTaskId">,
): boolean {
  return operation.submissionState === "submitting" && !operation.remoteTaskId;
}

/** 실패로 끝난 자체 점검 뒤 원장을 닫는다: 수락 전 종료면 실패 종결, 수락됐을 수 있으면 대조 대기. */
export function settleComfyOperationAfterFailure(input: {
  ledger: Pick<OperationLedger, "markSettled" | "markUnknown">;
  runId: string;
  operation: CertificationOperationRecord;
  reasonCode?: string | undefined;
  now: string;
}): void {
  const { ledger, runId, operation } = input;
  const operationKey = operation.operationKey;
  const taskKind = operationKey ? operation.modeOperations[operationKey]?.taskKind : undefined;
  if (neverAcceptedComfySubmission(operation) && taskKind) {
    ledger.markSettled(runId, {
      expectedRevision: operation.revision,
      result: {
        ok: false,
        taskKind,
        stage: "contract",
        reasonCode: input.reasonCode || "create_failed_before_acceptance",
      },
      now: input.now,
    });
    return;
  }
  ledger.markUnknown(runId, {
    expectedRevision: operation.revision,
    userAction: "reconcile_or_contact_provider",
    now: input.now,
    ...(operation.remoteTaskId ? { remoteTaskId: operation.remoteTaskId } : {}),
  });
}
