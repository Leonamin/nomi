import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('native browser entry capability', () => {
  it('gates the native-chrome app bar on the bridge capability', () => {
    const source = readFileSync('src/ui/app-shell/NomiAppBar.tsx', 'utf8')
    expect(source).toContain('!isWindows && window.nomiDesktop?.browser ?')
  })
  it('gates the Windows window bar and project library on the same capability', () => {
    expect(readFileSync('src/workbench/WorkbenchShell.tsx', 'utf8')).toContain('window.nomiDesktop?.browser ?')
    expect(readFileSync('src/workbench/library/ProjectLibraryPage.tsx', 'utf8')).toContain('const canOpenBrowser = Boolean(window.nomiDesktop?.browser)')
  })
})
