import { logRendererError } from '../../../desktop/rendererLog'
import { useEffect } from 'react'
import { getDesktopBridge } from '../../../desktop/bridge'
import { useGenerationCanvasStore } from '../store/generationCanvasStore'
/** Reconnecting views follow the server-owned job; authored canvas edits stay local. */
export function useWebGenerationSync(projectId: string | null | undefined): void {
  useEffect(() => {
    const api = getDesktopBridge()?.web
    if (!api || !projectId) return
    let isStopped = false
    let isReading = false
    const seen = new Set<string>()
    const sync = async () => {
      if (isReading) return
      isReading = true
      try {
        const snapshot = await api.generationSnapshot(projectId)
        if (isStopped) return
        for (const entry of snapshot) {
          if (!entry.node || seen.has(entry.key)) continue
          const current = useGenerationCanvasStore.getState().nodes.find(node => node.id === entry.node!.id)
          if (!current) {
            if (entry.node.meta?.isWebAgentCreated === true) {
              useGenerationCanvasStore.getState().applyEventTail([{ type: 'canvas.node.added', payload: { node: entry.node } }])
              await api.acknowledgeAgentNodes(projectId, [entry.node.id])
            } else continue
          }
          const node = entry.node
          const applied = current || node
          const hasSeenResult = node.result && [applied.result, ...(applied.history ?? [])].some(result => result?.id === node.result?.id)
          const hasAppliedSameRun = applied.runs?.[0]?.id === node.runs?.[0]?.id
          if (!entry.isPending && node.status === 'success' && hasSeenResult && applied.status === 'success' && hasAppliedSameRun) { seen.add(entry.key); continue }
          // Never overwrite a newly authored run with the preceding completed job.
          if (!entry.isPending && applied.runs?.[0] && node.runs?.[0] && applied.runs[0].startedAt > node.runs[0].startedAt) { seen.add(entry.key); continue }
          useGenerationCanvasStore.getState().updateNode(node.id, {
            status: node.status, error: node.error, progress: node.progress, runs: node.runs,
            result: node.result, history: node.history, size: node.size,
            meta: { ...applied.meta, ...(node.meta?.isWebGenerationOwned ? { isWebGenerationOwned: true, webJobKey: entry.key } : {}) },
          }, { history: false })
          if (!entry.isPending) seen.add(entry.key)
        }
      } catch (error) { if (!isStopped) logRendererError('web-generation-reconnect-query-failed', error) }
      finally { isReading = false }
    }
    void sync()
    const timer = window.setInterval(() => void sync(), 2000)
    return () => { isStopped = true; window.clearInterval(timer) }
  }, [projectId])
}
