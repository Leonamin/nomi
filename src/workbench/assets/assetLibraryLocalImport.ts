import * as React from 'react'
import i18n from '../../i18n'
import { getDesktopBridge, type DesktopAssetDto } from '../../desktop/bridge'
import { notify } from '../../ui/notificationPolicy'
import { mediaImportRejectionMessages } from './mediaImportMessage'
import type { MediaImportRejection } from '../../../electron/shared/contracts/mediaImportPolicy'
import { logRendererError } from '../../desktop/rendererLog'
import { unwrapAssetImportResult } from '../../../electron/shared/contracts/assetImportResult'

export type LocalImageImportResult = {
  created: DesktopAssetDto[]
  /** 被准入闸挡下的文件，带机器可读原因与数字。 */
  rejected: Array<{ fileName: string; rejection: MediaImportRejection }>
  failedCount: number
}

function isAbsoluteFilePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value)
}

export function filePathsFromDrop(files: ArrayLike<File>, getPathForFile?: (file: File) => string): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    let candidate: unknown
    try {
      const nativePath = getPathForFile?.(file)
      candidate = typeof nativePath === 'string' && nativePath.trim() ? nativePath : undefined
    } catch {
      candidate = undefined
    }
    candidate ??= (file as File & { path?: unknown } | undefined)?.path
    const filePath = typeof candidate === 'string' ? candidate.trim() : ''
    if (!filePath || !isAbsoluteFilePath(filePath) || seen.has(filePath)) continue
    seen.add(filePath)
    paths.push(filePath)
  }
  return paths
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const closest = (target as { closest?: (selector: string) => unknown }).closest
  return typeof closest === 'function' && Boolean(closest.call(target, 'input, textarea, [contenteditable="true"]'))
}

/** Finder 拖入 / 粘贴素材库的落盘路。与「上传」按钮同一条（主进程 importLocalFiles），收全部媒体。 */
export async function importLocalPathsToLibrary(projectId: string | null, paths: string[]): Promise<LocalImageImportResult> {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) throw new Error('projectId is required for local media import')
  const copyFiles = getDesktopBridge()?.assets?.copyFiles
  if (!copyFiles) throw new Error('native local media import is unavailable')
  return copyFiles({ projectId: normalizedProjectId, paths })
}

/** Drop files keep their browser bytes; Electron retains its native-path batch copy. */
export async function importDroppedFilesToLibrary(projectId: string | null, files: File[]): Promise<LocalImageImportResult> {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) throw new Error('projectId is required for local media import')
  const bridge = getDesktopBridge()
  if (bridge?.platform !== 'web') {
    return importLocalPathsToLibrary(normalizedProjectId, filePathsFromDrop(files, bridge?.clipboard?.getPathForFile))
  }
  const importNativeFile = bridge.assets?.importNativeFile
  if (!importNativeFile) throw new Error('browser media import is unavailable')
  const result: LocalImageImportResult = { created: [], rejected: [], failedCount: 0 }
  for (const file of files) {
    try {
      const imported = await importNativeFile(file, {
        projectId: normalizedProjectId,
        fileName: file.name || 'asset',
        contentType: file.type || 'application/octet-stream',
        kind: 'upload',
      })
      if (!imported) throw new Error('asset import did not return a result')
      result.created.push(unwrapAssetImportResult(imported))
    } catch (error) {
      logRendererError('asset-local-import-file-failed', error)
      result.failedCount += 1
    }
  }
  return result
}

function reportImport(result: LocalImageImportResult, report: (message: string) => void): void {
  for (const message of mediaImportRejectionMessages(result.rejected ?? [])) report(message)
  if (result.failedCount > 0) {
    report(i18n.t('assetLibrary.localImportFailed', { count: result.failedCount }))
  }
}

type UseAssetLibraryLocalImportOptions = {
  projectId: string | null
  refreshProjectAssets: () => void
  refreshAllProjectAssets: () => void
  present: (message: string) => void
}

export function useAssetLibraryLocalImport({
  projectId,
  refreshProjectAssets,
  refreshAllProjectAssets,
  present,
}: UseAssetLibraryLocalImportOptions): {
  isDragOver: boolean
  onDragOver: React.DragEventHandler<HTMLDivElement>
  onDragLeave: React.DragEventHandler<HTMLDivElement>
  onDrop: React.DragEventHandler<HTMLDivElement>
  onPaste: React.ClipboardEventHandler<HTMLDivElement>
} {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const report = React.useCallback((message: string, type: 'warning' | 'error' = 'warning') => {
    notify({ identity: `asset-import:${projectId ?? ''}`, reason: 'local-import', message, type, level: 'inline', present })
  }, [projectId, present])

  const runImport = React.useCallback(async (count: number, importFiles: () => Promise<LocalImageImportResult>) => {
    present('')
    if (count === 0) {
      report(i18n.t('assetLibrary.localImportNoImages'), 'warning')
      return
    }
    try {
      const result = await importFiles()
      refreshProjectAssets()
      refreshAllProjectAssets()
      reportImport(result, report)
    } catch (error) {
      logRendererError('asset-local-import-failed', error)
      report(i18n.t('assetLibrary.localImportFailed', { count }), 'error')
    }
  }, [refreshAllProjectAssets, refreshProjectAssets, present, report])

  const onDragOver = React.useCallback<React.DragEventHandler<HTMLDivElement>>((event) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const onDragLeave = React.useCallback<React.DragEventHandler<HTMLDivElement>>((event) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDragOver(false)
  }, [])

  const onDrop = React.useCallback<React.DragEventHandler<HTMLDivElement>>((event) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    setIsDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    const bridge = getDesktopBridge()
    const count = bridge?.platform === 'web'
      ? files.length
      : filePathsFromDrop(files, bridge?.clipboard?.getPathForFile).length
    void runImport(count, () => importDroppedFilesToLibrary(projectId, files))
  }, [projectId, runImport])

  const onPaste = React.useCallback<React.ClipboardEventHandler<HTMLDivElement>>((event) => {
    if (isTextEditingTarget(event.target)) return
    event.preventDefault()
    present('')
    const readFilePaths = getDesktopBridge()?.clipboard?.readFilePaths
    if (!readFilePaths) {
      report(i18n.t('assetLibrary.localImportUnavailable'), 'error')
      return
    }
    void readFilePaths()
      .then((paths) => runImport(paths.length, () => importLocalPathsToLibrary(projectId, paths)))
      .catch((error) => {
        logRendererError('asset-clipboard-read-failed', error)
        report(i18n.t('assetLibrary.localImportFailed', { count: 1 }), 'error')
      })
  }, [projectId, runImport, present, report])

  return { isDragOver, onDragOver, onDragLeave, onDrop, onPaste }
}
