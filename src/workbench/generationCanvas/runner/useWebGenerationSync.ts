import { logRendererError } from '../../../desktop/rendererLog'
import { useEffect } from 'react'
import { getDesktopBridge } from '../../../desktop/bridge'
import { useGenerationCanvasStore } from '../store/generationCanvasStore'
import { useWorkbenchStore } from '../../workbenchStore'
import { stableProjectAgentJson } from '../../../../electron/shared/legacyAgentJson'
/** Reconnecting views follow the server-owned job; authored canvas edits stay local. */
export function useWebGenerationSync(projectId: string | null | undefined): void {
  useEffect(() => {
    const api = getDesktopBridge()?.web
    if (!api || !projectId) return
    let isStopped = false
    let isReading = false
    const sync = async () => {
      if (isReading) return
      isReading = true
      try {
        const [snapshot, creation] = await Promise.all([api.generationSnapshot(projectId), api.creationSnapshot(projectId)])
        if (isStopped) return
        const state = useWorkbenchStore.getState()
        const local = { workbenchDocuments: state.workbenchDocuments, storyboardDesignsByDocumentId: state.storyboardDesignsByDocumentId }
        const projected = api.projectCreation(local, creation.payload, api.appliedCreationKnowledge(projectId))
        const json = (value: unknown) => stableProjectAgentJson(JSON.parse(JSON.stringify(value ?? null)))
        if (json(local.workbenchDocuments) !== json(projected.workbenchDocuments)) state.hydrateWorkbenchDocuments(projected.workbenchDocuments || [], state.activeDocumentId)
        if (json(local.storyboardDesignsByDocumentId) !== json(projected.storyboardDesignsByDocumentId)) state.hydrateStoryboardDesigns(projected.storyboardDesignsByDocumentId || {})
        api.acknowledgeCreation(projectId, creation.knowledge)
        const canvas = useGenerationCanvasStore.getState()
        const localCanvas = { nodes: canvas.nodes, groups: canvas.groups, edges: canvas.edges }
        const next = api.projectGenerationCanvas(localCanvas, snapshot.canvas, api.appliedCanvasKnowledge(projectId))
        if (json(localCanvas) !== json({ nodes: next.nodes, groups: next.groups, edges: next.edges })) {
          canvas.applyEventTail([{ type: 'canvas.snapshot.restored', payload: { snapshot: next } }])
        }
        // Acknowledgement occurs only after the exact projection was applied.
        api.acknowledgeCanvas(projectId, snapshot.knowledge)
        await api.acknowledgeAgentNodes(projectId, next.nodes.filter(node => node.meta?.isWebAgentCreated === true).map(node => node.id))
      } catch (error) { if (!isStopped) logRendererError('web-generation-reconnect-query-failed', error) }
      finally { isReading = false }
    }
    void sync()
    const timer = window.setInterval(() => void sync(), 2000)
    return () => { isStopped = true; window.clearInterval(timer) }
  }, [projectId])
}
