import type { RunCommand } from "./productionRunTypes";
import { isProductionRunIdentifier } from "../shared/productionRunCommandId";

const RENDERER_COMMAND_TYPES = new Set(["run.status", "run.control", "gate.decide", "artifact.adopt", "artifact.review", "plan.attach", "policy.refresh", "job.reconcile", "plan.detach-shot-nodes", "generation.present"]);

/** 标识形状只认中立层那一份（渲染层造命令号用的也是它）：两边各写一份就会各自漂，漂了的命令在这里被拒。 */
export function identifier(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!isProductionRunIdentifier(normalized)) throw new Error(`Invalid ${label} id`);
  return normalized;
}

export function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function storyboardMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  for (const key of ["shotId", "ffDesc", "motionDesc", "subtitle", "dialogue", "lfDesc"]) {
    if (typeof raw[key] === "string" && raw[key].trim()) metadata[key] = raw[key].trim();
  }
  const transition = raw.transition;
  const transitionType = transition && typeof transition === "object" && !Array.isArray(transition)
    ? (transition as Record<string, unknown>).type
    : transition;
  if (transitionType === "cut" || transitionType === "dissolve" || transitionType === "fade" || transitionType === "match_cut" || transitionType === "whip_pan") {
    const durationFrames = transition && typeof transition === "object" && !Array.isArray(transition)
      ? (transition as Record<string, unknown>).durationFrames
      : undefined;
    metadata.transition = {
      type: transitionType,
      ...(typeof durationFrames === "number" && Number.isInteger(durationFrames) && durationFrames > 0 ? { durationFrames } : {}),
    };
  }
  if (raw.variationType === "large" || raw.variationType === "medium" || raw.variationType === "small") metadata.variationType = raw.variationType;
  if (typeof raw.camIdx === "number" && Number.isInteger(raw.camIdx) && raw.camIdx >= 0) metadata.camIdx = raw.camIdx;
  if (raw.continuity !== undefined && (typeof raw.continuity === "string" || typeof raw.continuity === "number" || (typeof raw.continuity === "object" && raw.continuity !== null && !Array.isArray(raw.continuity)))) metadata.continuity = raw.continuity;
  return Object.keys(metadata).length ? metadata : undefined;
}

function rendererCommandPayload(type: string, value: unknown): Record<string, unknown> {
  const raw = objectValue(value, "production command payload");
  if (type === "generation.present") {
    if (!Number.isSafeInteger(raw.sourceDocumentRevision) || Number(raw.sourceDocumentRevision) < 0) throw new Error("Invalid source document revision");
    if (!Array.isArray(raw.shotIds) || raw.shotIds.length === 0 || raw.shotIds.length > 256) throw new Error("Invalid generation scope");
    const shotIds = raw.shotIds.map(value => identifier(value, "shot"));
    if (new Set(shotIds).size !== shotIds.length) throw new Error("Duplicate generation scope");
    return { sourceDocumentId: identifier(raw.sourceDocumentId, "source document"), sourceDocumentRevision: Number(raw.sourceDocumentRevision), shotIds };
  }

  if (type === "run.status") {
    return { status: typeof raw.status === "string" ? raw.status.trim() : raw.status };
  }
  if (type === "gate.decide") {
    // B1：方向门批准可带 choiceKey（用户选中的候选）。key 形状受限，非法则丢弃（reducer 再校验属不属该门）。
    const rawChoice = typeof raw.choiceKey === "string" ? raw.choiceKey.trim() : "";
    const choiceKey = /^[A-Za-z0-9._-]{1,40}$/.test(rawChoice) ? rawChoice : undefined;
    return {
      gateId: identifier(raw.gateId, "gate"),
      status: typeof raw.status === "string" ? raw.status.trim() : raw.status,
      ...(choiceKey ? { choiceKey } : {}),
    };
  }
  if (type === "plan.attach") {
    const rawBindings = Array.isArray(raw.bindings) ? raw.bindings : [];
    if (rawBindings.length > 128) throw new Error("Too many production bindings");
    const bindings = rawBindings.map((value, index) => {
      const binding = objectValue(value, `production binding ${index}`);
      const model = typeof binding.model === "string" ? binding.model.trim() : "";
      const hasControlCharacter = Array.from(model).some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 0x1f || codePoint === 0x7f;
      });
      if (!model || model.length > 240 || hasControlCharacter || model.startsWith("/") || model.startsWith("\\") || model.split(/[\\/]+/).includes("..")) {
        throw new Error(`Invalid production binding model ${index}`);
      }
      const metadata = storyboardMetadata(binding.metadata ?? binding);
      return {
        nodeId: identifier(binding.nodeId, "node"),
        provider: identifier(binding.provider, "provider"),
        model,
        stageId: identifier(binding.stageId ?? "generate", "stage"),
        ...(metadata ? { metadata } : {}),
      };
    });
    return {
      artifactId: identifier(raw.artifactId, "artifact"),
      ...(raw.sourceScriptArtifactId !== undefined ? { sourceScriptArtifactId: identifier(raw.sourceScriptArtifactId, "source script artifact") } : {}),
      ...(raw.sourceScriptVersion !== undefined ? { sourceScriptVersion: Number.isInteger(raw.sourceScriptVersion) && Number(raw.sourceScriptVersion) > 0 ? Number(raw.sourceScriptVersion) : (() => { throw new Error("Invalid source script version"); })() } : {}),
      ...(raw.sourceScriptHash !== undefined ? { sourceScriptHash: typeof raw.sourceScriptHash === "string" && raw.sourceScriptHash.trim() && raw.sourceScriptHash.length <= 256 ? raw.sourceScriptHash.trim() : (() => { throw new Error("Invalid source script hash"); })() } : {}),
      bindings,
    };
  }
  if (type === "policy.refresh") return {};
  if (type === "job.reconcile") {
    const outcome = typeof raw.outcome === "string" ? raw.outcome.trim() : "";
    if (outcome !== "found" && outcome !== "not_found" && outcome !== "user_checked_abandon") throw new Error("Invalid production reconciliation outcome");
    return { jobId: identifier(raw.jobId, "job"), outcome };
  }
  // A4 暂停/继续/取消。合法性（当前状态允不允许这个动作）由 applyRunControl 判，这里只管形状。
  if (type === "run.control") {
    const action = typeof raw.action === "string" ? raw.action.trim() : "";
    if (!["pause", "resume", "cancel"].includes(action)) throw new Error("Invalid production control action");
    return { action };
  }
  // P4 S5：用户把这些占位节点从画布删掉（整批 Cmd+Z / 手动删）→ Run 记 detached（撤销事实优先，恢复不复活）。
  // 渲染层发起是合法的（这是「用户删了画布节点」的忠实映射）；只收 nodeId 数组，形状受限、上限防滥用。
  if (type === "plan.detach-shot-nodes") {
    const rawNodeIds = Array.isArray(raw.nodeIds) ? raw.nodeIds : [];
    if (rawNodeIds.length > 256) throw new Error("Too many detached nodes");
    const nodeIds = rawNodeIds.map((value, index) => identifier(value, `node ${index}`));
    return { nodeIds };
  }
  if (type === "artifact.adopt") return { artifactId: identifier(raw.artifactId, "artifact") };
  if (type === "artifact.review") {
    const decision = typeof raw.decision === "string" ? raw.decision.trim() : "";
    if (!["approved", "changes_requested", "rejected"].includes(decision)) throw new Error("Invalid artifact review decision");
    return { artifactId: identifier(raw.artifactId, "artifact"), decision };
  }
  // 白名单里有、这里却没建 payload 的类型必须**响亮地**炸。原先这行是 artifact.adopt 的兜底 return，
  // 于是 run.control 掉进来被当成产物命令，用户在 Nomi 里点取消只会看到「Invalid artifact id」——
  // 暂停/继续/取消从渲染端就没通过（2026-08-18 走查逮到）。默认分支不许再替别人猜形状。
  throw new Error(`Production command payload is not implemented: ${type}`);
}

export function rendererCommand(value: unknown, shouldAttestHumanGesture = false): RunCommand {
  const raw = objectValue(value, "production command");
  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  if (!RENDERER_COMMAND_TYPES.has(type)) throw new Error("Production command is not available to the renderer");
  if (!Number.isInteger(raw.expectedRevision) || Number(raw.expectedRevision) < 0) {
    throw new Error("Invalid production command revision");
  }
  return {
    commandId: identifier(raw.commandId, "command"),
    expectedRevision: Number(raw.expectedRevision),
    type,
    payload: rendererCommandPayload(type, raw.payload),
    issuedAt: typeof raw.issuedAt === "string" && raw.issuedAt.trim() ? raw.issuedAt.trim() : new Date().toISOString(),
    // 真人手势章：调用方已过 assertTrustedSender（Nomi 自己的窗口），且渲染层的确认卡是这条命令的唯一来路。
    // 章由这里**自己盖**，不看 raw——渲染层伪造不了、MCP 客户端根本进不来这个通道。付费门在没有收据时
    // 认它当人证（productionRunApprovalReceipt.ts）。只盖在真的要它的命令上（gate.decide），别在整条渲染
    // 通道上撒一个万能标记。注意：这只证「来自受信窗口」，不是一条带签名的手势证明；升级成
    // createMainProcessGestureAttestation 需要确认卡先领 challenge，见 docs/fixes 合同的残留风险。
    ...(shouldAttestHumanGesture && (type === "gate.decide" || type === "job.reconcile") ? { humanGesture: true as const } : {}),
  };
}
