import { resolveIndexedReferencePreview } from '../capabilityCore/pendingSpendReferences';
import { ipcMain } from "electron";

import { createProductionRunRepository, type ProductionRunRepository } from "./productionRunRepository";
import { getProductionRunService } from "./productionRunRuntime";
import type { ProductionRunService } from "./productionRunService";
import type { CreateProductionRunInput } from "./productionRunTypes";


import { assertTrustedSender } from "../ipcSenderGuard";
import { identifier, objectValue, rendererCommand } from './productionRunRendererCommand';
function createDraftInput(value: unknown): CreateProductionRunInput {
  const raw = objectValue(value, "production draft");
  const playbook = objectValue(raw.playbook, "playbook");
  const origin = objectValue(raw.origin, "origin");
  const rawBrief = raw.brief && typeof raw.brief === 'object' && !Array.isArray(raw.brief) ? raw.brief as Record<string, unknown> : null;
  const goal = typeof rawBrief?.goal === 'string' ? rawBrief.goal.trim() : '';
  const brief = goal ? {
    goal,
    ...(typeof rawBrief?.audience === 'string' && rawBrief.audience.trim() ? { audience: rawBrief.audience.trim() } : {}),
    ...(typeof rawBrief?.channel === 'string' && rawBrief.channel.trim() ? { channel: rawBrief.channel.trim() } : {}),
    ...(typeof rawBrief?.tone === 'string' && rawBrief.tone.trim() ? { tone: rawBrief.tone.trim() } : {}),
    ...(typeof rawBrief?.durationSeconds === 'number' ? { durationSeconds: rawBrief.durationSeconds } : {}),
    ...(Array.isArray(rawBrief?.sellingPoints) ? { sellingPoints: rawBrief.sellingPoints.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) } : {}),
  } : undefined;
  return {
    projectId: identifier(raw.projectId, "project"),
    playbook: {
      name: identifier(playbook.name, "playbook"),
      version: typeof playbook.version === "string" && playbook.version.trim() ? playbook.version.trim() : "1.0.0",
    },
    origin: {
      host: identifier(origin.host, "origin host"),
      ...(typeof origin.actorId === "string" && origin.actorId.trim() ? { actorId: origin.actorId.trim() } : {}),
    },
    ...(brief ? { brief } : {}),
  };
}

function projectRunPayload(value: unknown): { projectId: string; runId: string; raw: Record<string, unknown> } {
  const raw = objectValue(value, "production run request");
  return {
    projectId: identifier(raw.projectId, "project"),
    runId: identifier(raw.runId, "run"),
    raw,
  };
}

function assertProjectRun(repository: ProductionRunRepository, projectId: string, runId: string) {
  const run = repository.read(projectId, runId);
  if (!run) throw new Error(`Production run not found: ${runId}`);
  if (run.projectId !== projectId) throw new Error("Production run project mismatch");
  return run;
}

export function registerProductionRunIpc(
  repositoryOrService: ProductionRunRepository | ProductionRunService = getProductionRunService(),
): void {
  const service = "command" in repositoryOrService
    ? repositoryOrService
    : null;
  const repository: ProductionRunRepository | null = service ? null : (repositoryOrService as ProductionRunRepository || createProductionRunRepository());
  const read = (projectId: string, runId: string) => service ? service.readFull(projectId, runId) : repository!.read(projectId, runId);
  // The list is the summary projection in both modes. It used to hand the renderer full Runs in service
  // mode (every job, gate and plan, every 1.5s) while the bridge type promised summaries, so fields that
  // only the projection derives (the draft line, plan presence) never reached the task list.
  const list = (projectId: string) => (repository ?? service!.repository).list(projectId);
  ipcMain.handle("nomi:production-runs:list", async (event, payload: unknown) => {
    assertTrustedSender(event);
    const raw = objectValue(payload, "production run list request");
    return list(identifier(raw.projectId, "project"));
  });
  ipcMain.handle("nomi:production-runs:read", async (event, payload: unknown) => {
    assertTrustedSender(event);
    const { projectId, runId } = projectRunPayload(payload);
    const run = read(projectId, runId);
    if (run && run.projectId !== projectId) throw new Error("Production run project mismatch");
    if (!run?.generationPlan) return run;
    const references=run.generationPlan.shots?.length ? run.generationPlan.shots.flatMap(shot=>shot.candidate.references) : run.generationPlan.candidate.references;
    return references.length ? {...run,storyboardReferenceUrls:Object.fromEntries(references.map(reference=>[reference.assetId,resolveIndexedReferencePreview(projectId,reference)]))} : run;
  });
  ipcMain.handle("nomi:production-runs:create-draft", async (event, payload: unknown) => {
    assertTrustedSender(event);
    return service ? service.createDraft(createDraftInput(payload)) : repository!.create(createDraftInput(payload));
  });
  ipcMain.handle("nomi:production-runs:command", async (event, payload: unknown) => {
    assertTrustedSender(event);
    const { projectId, runId, raw } = projectRunPayload(payload);
    const command = rendererCommand(raw.command, true);
    if (command.type === "generation.present") {
      const current = read(projectId, runId);
      const source = current?.origin.sourceDocument;
      if (!current || current.projectId !== projectId || current.origin.host !== "nomi"
        || !source || command.payload.sourceDocumentId !== source.documentId
        || command.payload.sourceDocumentRevision !== source.revision) throw new Error("Storyboard source mismatch");
      // The normal repository CAS and scope reducer arbitrate any subsequent change.
      // This exposes a pending card; approval remains exclusively in the spend boundary.
    }
    if (service) {
      if (!read(projectId, runId)) throw new Error(`Production run not found: ${runId}`);
      return service.command(projectId, runId, command);
    }
    assertProjectRun(repository!, projectId, runId);
    return repository!.execute(projectId, runId, command);
  });
  ipcMain.handle("nomi:production-runs:materialize-storyboard", async (event, payload: unknown) => {
    assertTrustedSender(event);
    const { projectId, runId, raw } = projectRunPayload(payload);
    if (!read(projectId, runId)) throw new Error(`Production run not found: ${runId}`);
    const artifactId = identifier(raw.artifactId, "artifact");
    const expectedVersion = Number(raw.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) throw new Error("Invalid storyboard artifact version");
    if (!service) throw new Error("Storyboard materialization requires the production service");
    return service.materializeStoryboard({ projectId, runId, artifactId, expectedVersion });
  });
  ipcMain.handle("nomi:production-runs:events", async (event, payload: unknown) => {
    assertTrustedSender(event);
    const { projectId, runId, raw } = projectRunPayload(payload);
    if (!read(projectId, runId)) throw new Error(`Production run not found: ${runId}`);
    const cursor = raw.afterCursor === undefined ? 0 : Number(raw.afterCursor);
    if (!Number.isInteger(cursor) || cursor < 0) throw new Error("Invalid production event cursor");
    return repository ? repository.readEvents(projectId, runId, cursor) : service!.readEvents(projectId, runId, cursor, 0).then((value) => value.events);
  });
}
