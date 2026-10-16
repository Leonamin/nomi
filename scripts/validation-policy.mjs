// 核心流程冒烟（2026-09-22 用户拍板，docs/plan/2026-09-22-core-flow-smoke-three-defenses.md）：
// **除了纯文档，一律跑**，两种夹具各一遍。它不跟任何路径模式挂钩——09-22 那次回归坏在共享的 CSS 开关上，
// 画布套件因为「没改到 generationCanvas」被分类器跳过，核心流程三件事全坏、CI 全绿。
// 夹具清单的唯一 owner 在这里（CI matrix、合后收据要的 check 名都从它派生，check-quality-gate-workflow 钉死）。
export const CORE_SMOKE_FIXTURES = Object.freeze(['empty', 'used'])
// 阻断门只有 empty（2026-09-22 用户拍板）。used 照跑、照传证据，但**不判**：
// 实测同一份代码连跑 5 次只有 1 次全绿，三种失败都出自还没修的小窗布局问题
// （批量栏压住缩放条 / 托盘贴边被 clamp / toast 盖住弹窗钮），
// 证据见 docs/evidence/2026-09-22-core-smoke-negative-control/。把一条 5 次绿 1 次的检查
// 装成必过门 + 合后收据的 success-only，等于把假红制度化，这正是本防线要根除的东西。
// **升阻断的条件**：那三条布局 bug 修完，且 used 连跑 5 次全绿——届时把 'used' 加进下面这行即可，
// CI 的 continue-on-error 与合后收据都从它派生，不必再改别处。
export const CORE_SMOKE_BLOCKING_FIXTURES = Object.freeze(['empty'])
export const CORE_SMOKE_ADVISORY_FIXTURES = Object.freeze(CORE_SMOKE_FIXTURES.filter((f) => !CORE_SMOKE_BLOCKING_FIXTURES.includes(f)))
export const coreSmokeCheckName = (fixture) => `Core Flow Smoke (${fixture})`
export const CORE_SMOKE_CHECK_NAMES = Object.freeze(CORE_SMOKE_FIXTURES.map(coreSmokeCheckName))
export const CORE_SMOKE_BLOCKING_CHECK_NAMES = Object.freeze(CORE_SMOKE_BLOCKING_FIXTURES.map(coreSmokeCheckName))
export const CORE_SMOKE_ADVISORY_CHECK_NAMES = Object.freeze(CORE_SMOKE_ADVISORY_FIXTURES.map(coreSmokeCheckName))

const FULL_POLICY = Object.freeze({
  coreSmoke: true,
  unit: 'full',
  desktop: true,
  journeys: true,
  canvas: 'full',
  performance: true,
  package: true,
})

// Validation infrastructure changes exercise the gate itself. They still run
// the full functional lanes, but performance and packaging are separate risk
// surfaces and must not turn runner variance into an unrelated merge blocker.
const VALIDATION_INFRASTRUCTURE_POLICY = Object.freeze({
  coreSmoke: true,
  unit: 'full',
  desktop: true,
  journeys: true,
  canvas: 'full',
  performance: false,
  package: false,
})

const VALIDATION_INFRASTRUCTURE_PATTERNS = [
  /^\.github\/(?:actions|workflows)\//,
  /^scripts\/(?:validation-policy|select-quality-gate-profile|check-quality-gate-workflow|real-user-test-gates|test-system|test-focused|git-delivery|canvas-performance-verdict|eval-journey|.*walkthrough)(?:\.|$)/,
  /^tests\/system(?:\/|$)/,
  // 核心冒烟的清单 / 夹具 / 跑法：改它等于改每个 PR 都要过的那道闸。
  /^tests\/ux\/core-smoke\//,
  /^tests\/ux\/(?:canvas-real-suite|canvas-performance-(?:benchmark|verdict))(?:\.|$)/,
  // 走查的**共享 harness**（下划线前缀那一族：_launchApp / _assert / _canvasHit / _feel …）。
  // 它们是所有 Electron 走查的启动器、断言库和命中判据——改一行等于改全部走查的地基，
  // 可此前没有任何 pattern 认领它们，会被判成 isolated_change 走 focused（2026-09-12 补，
  // 判据与先红后绿的证据见 scripts/run-gates-tests.node-test.mjs）。下划线前缀是判据的一部分：
  // 具名走查脚本（tests/ux/smoke.e2e.mjs 等）只是单个场景，不该把整台机器拖进全量。
  /^tests\/ux\/_[^/]+\.(?:mjs|cjs|js|ts|mts)$/,
  /^(?:eslint|playwright|vitest)\.config\.(?:ts|mts|cts|js|mjs|cjs)$/,
]

// 纯文档判据（docs_only）的唯一 owner。docs/ 与 marketing/ 是整棵子树；根目录另有三族
// 只给人和 Agent 看、不进产物也不被任何运行时读取的文件：README*（含 README.zh-CN.md）、
// 以及根目录的 AGENTS.md / CLAUDE.md。后两个此前不在名单里，于是「只改一份 Agent 说明」
// 的 PR 被判成 isolated_change 而不是 docs_only，两格核心冒烟在纯文档 diff 上照跑
// （2026-09-22 #843 实测）。**只认根目录**：src/**/CLAUDE.md 那二十来份贴着代码住，
// 继续走 fail-safe 的常规判定，不在本条放宽范围内。
// 根目录其余 .md（CHANGELOG / CLA / Design / CODEX-REPORT / MARKET-RESEARCH）性质相同但
// 本次不放宽——漏判只是多跑一遍冒烟（安全方向），加进来才需要逐个论证没有门岗挂着它们。
// The fork wiki contains prose; executable or unknown wiki files remain fail-closed.
const DOCS_ONLY_PATTERN = /^(?:docs\/|marketing\/|wiki\/.*\.md$|\.agents\/wiki-(?:path|structure\.md)$|README[^/]*$|AGENTS\.md$|CLAUDE\.md$)/

// 认得出的路径（2026-10-02，复盘 fixes 行 52、133：新路径悄悄落进「孤立改动 → focused」而漏跑该跑的档）。
// 默认值反过来：**认不出的路径一律跑全量**，再按事故顺序逐个加性质测试；认得出 = 下面这几类里的某一类。
// 往这里加一类之前先问「这类路径的改动真的只会影响同目录 sibling 测试吗」，不确定就别加。
// `web` 는 브라우저 워크스페이스(2026-10-12 `docs/plan/2026-10-12-personal-web.md`)의 루트다.
// 여기 넣지 않으면 "인식 못 하는 경로 → 전량"에 걸려, web만 바꾼 PR도 데스크톱 전용 레인
// (캔버스 인수·성능·Electron 워크스루·Mac 패키지)을 전부 돈다. web 전용 프로파일은
// 아래 WEB_SURFACE_PATTERNS + `webOnly` 분기가 정한다 — 여기서 "인식"만 시킨다.
const RECOGNIZED_ROOT_PATTERNS = [
  /^(?:src|electron|scripts|tests|evals|skills|agent-skills|public|assets|infra|worker|workers|experiments|artifacts|web|\.claude|\.agents|\.codex|\.superpowers|\.design-sync)\//,
  /^(?:index|design-lab|director-lab)\.html$/,
  /^[^/]+\.md$/,
  /^(?:LICENSE|\.gitignore|\.gitattributes|\.prettierignore|\.prettierrc\.json|\.mcp\.json)$/,
]

const PACKAGE_PATTERNS = [
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.pnpmrc)$/,
  /^electron-builder(?:\.[^/]+)?\.(?:cjs|js|json|ya?ml)$/,
  /^vite\.config\.(?:ts|mts|cts|js|mjs|cjs)$/,
  /^tsconfig[^/]*\.json$/,
  /^electron\/(?:main|preload|runtimePaths|mainProcessLifecycle)\.(?:ts|tsx|js|mjs|cjs)$/,
  /^scripts\/(?:electron-install-identity|release-contract)(?:\.|$)/,
  // The packaged MCP smoke (dist:mac:dir) asserts the packaged server's behaviour and tool
  // surface. The truth sources of that surface — capability-core (catalog/collapse/stdio
  // server/launcher) and the harness tool-surface manifest — must select the package lane on
  // the PR path, or a surface change rides the fast path green and burns the next main push
  // (2026-09-02: surface-16-collapse escaped exactly this way; see docs/fixes/
  // 2026-09-02-packaged-mcp-smoke-stale-catalog-anchor.root-cause.json).
  /^electron\/capabilityCore\//,
  /^electron\/shared\/agentCapabilities\/(?:verbDeclarations\.ts$|verbs\/)/,
  // The smoke instrument itself: editing the packaged smoke must re-run the packaged smoke
  // (same rule as PERFORMANCE_INSTRUMENT_PATTERNS — instrument edits re-run the instrument).
  /^tests\/ux\/packaged-mcp-smoke/,
]

const JOURNEY_PATTERNS = [
  /^(?:tests\/agent-runtime|evals\/model-integration)(?:\/|$)/,
  /^skills\/model-integration(?:\/|$)/,
  // The resident Agent shell is the shared UI entry point for real user journeys;
  // keep this boundary explicit instead of relying on the filename's `Agent` token.
  /^src\/workbench\/ai\/ProjectAgentResidentShell\.(?:ts|tsx)$/i,
  // Two Agent-panel walks registered in REAL_USER_TEST_MANIFEST on 2026-09-24, and the display owners
  // they guard: `resident/` decides which pending call is a timeline plan (a hand-copied tool-name
  // list there rotted for ten days after the 2026-09-14 verb rename), `skillDisplay.ts` owns a
  // skill's on-screen name. Neither path name carries the `agent`/`model` token matched below.
  /^src\/workbench\/ai\/resident\//,
  /^src\/workbench\/skillLibrary\/skillDisplay\.ts$/,
  /^tests\/ux\/agent-(?:real-user-conversation|transcript-merge)\.walk\.mjs$/,
  /^electron\/(?:ai|catalog|comfyui|providerAdapter|vendor)(?:\/|$)/,
  /^electron\/runtime(?:\.|\/)/,
  /^src\/.*(?:agent|bridge|credential|model|provider|catalog|comfyui|network|security|generationCanvas\/runner).*\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i,
  /^electron\/capabilityCore\/mcp.*\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i,
  /^tests\/ux\/mcp-(?:l1-handshake|journey).*\.(?:mjs|js|ts)$/i,
  /^tests\/ux\/(?:resident-composer-receipt-fix|storyboard-agent-canonical-patch|production-mcp-journey|golden-path)\.(?:e2e\.)?mjs$/i,
]

const DESKTOP_PATTERNS = [/^src\/desktop\/bridge\.(?:ts|tsx|js|jsx)$/]

// 브라우저 워크스페이스(2026-10-12). `web/` 는 `electron/**`(93곳)·`src/**`(29곳)을 단방향으로
// import 하지만 **역방향 의존은 0건**이다 — `src`/`electron` 어디도 `web/` 을 import 하지 않는다.
// 루트 tsconfig 도 데스크톱 build 도 `web/` 을 포함하지 않으므로, web만 바꾼 diff 는
// 데스크톱 Electron 앱이나 캔버스 성능·패키징에 영향을 줄 수 없다 → 그 레인들을 올리지 않는다.
// web 자체 테스트는 별도 `vitest.web.config.ts` / `pnpm run test:web` / `personal-web.yml` 이 소유한다
// (루트 vitest include 에 없어, 여기서 focused 로 보내면 "No test files found" 로 red 가 난다).
const WEB_SURFACE_PATTERNS = [/^web(?:\/|$)/]

// 「谁决定画布上显示什么」——改它们等于改画布上用户看得见的状态，必须跑 full 画布验收
// （canvas-landing / canvas-reconcile / batch-production 只在 full 档里）。
// 来历：#934 改了制作镜头占位的状态判定、#940 / #937 也碰了这一类，只拿到 critical，
// S5 回归就这样进了 main（画布显示归属那次回归）。清单对着 docs/engineering/concept-owners.json 里
// 画布显示相关概念的 owner 与写口列的（production.shot-phase / shot-jobs / shot-generation-ownership /
// run-stop-reason / run-lifecycle-settle / node-run-record），再加画布子树里产出显示的目录。
// generationCanvas 的每个子目录必须在 scripts/validation-policy.node-test.mjs 里表态
// （产出显示 → 这里；只管手势 / 样式 → critical），新目录没表态测试就红——
// 不再靠「想起来再补一个文件名」。
const CANVAS_DISPLAY_OWNER_PATTERNS = [
  // 主进程 / 共享层：一镜的阶段、批次成员、认领、停下原因、节点状态
  /^electron\/shared\/(?:productionShot[^/]*|productionRunStop|decideShotClaim|generationShotEnvelope)(?:\.|$)/,
  /^electron\/shared\/canvas\//,
  // 主进程画布落地投影与 Run 状态机（谁写节点运行记录、谁收尾）
  /^electron\/productionRun\/(?:canvasLandingHost|canvasShotClaim|multiShotCanvasLanding|productionRunCanvasLandingReducer|productionRunLifecycle|productionRunReducer|productionRunProjections|batchScheduleDerivation|batchSchedulerKick|multiShotBatchScheduler)(?:\.|$)/,
  // 渲染层：落地投影写入点与制作侧的镜头认领 / 动作
  /^src\/workbench\/capability\/multiShotCanvasLanding(?:Core)?(?:\.|$)/,
  /^src\/workbench\/production\/(?:ProductionCanvasLandingHost|productionCanvasLandingStore|productionShotOwnership|productionShotActions|reportDetachedShotNodes|watchDeletedProductionNodes)(?:\.|$)/,
  // 画布子树里产出显示的目录（reactFlow 另有自己的 full 规则）
  /^src\/workbench\/generationCanvas\/(?:nodes|spend|store|runner|model|agent|events|adapters)\//,
  /^src\/workbench\/generationCanvas\/[^/]+\.(?:ts|tsx)$/,
]

const CANVAS_PATTERNS = [
  ...CANVAS_DISPLAY_OWNER_PATTERNS,
  /^src\/workbench\/generationCanvas(?:\/|$)/,
  /^src\/workbench\/settings\/CanvasGestureSection\.tsx$/,
  /^src\/utils\/canvasGesturePreference(?:\.test)?\.ts$/,
  /^tests\/ux\/.*(?:canvas|react-flow|group-(?:ports|baseline|reference)|selection-toolbar).*(?:\.mjs|\.js|\.ts)$/,
]

const FULL_CANVAS_PATTERNS = [
  ...CANVAS_DISPLAY_OWNER_PATTERNS,
  /^src\/workbench\/generationCanvas\/reactFlow(?:\/|$)/,
  /^tests\/ux\/(?:canvas-real-suite|react-flow|canvas-drag-pan|group-ports|canvas-shortcuts|canvas-node-context|canvas-context-menu|canvas-batch|canvas-magnetic-handle|canvas-open-fit|selection-toolbar|group-baseline|group-reference).*/,
]

const PERFORMANCE_PATTERNS = [
  /^src\/workbench\/generationCanvas\/reactFlow(?:\/|$)/,
  /^src\/workbench\/generationCanvas\/nodes\/(?:DeferredNodeMedia|deferredNodeMediaQueue|renderRegistry|BaseGenerationNode|ClipNode(?:Preview)?|NodeVideoPlaybackGuard|useNodeVideoHoverPreview|nodeSizing|nodeResultStackPlacement)(?:\.|\/)/,
  /^tests\/ux\/(?:canvas-performance|fixtures\/canvas-performance).*/,
  // 真实素材登记表与它的执行层（R13「四件真实」第④件，2026-09-14）。改登记表 = 改这条 lane 的输入：
  // 素材换一份、覆盖面动一类，画布与性能两条腿量到的东西就变了，必须当场重量一次，不能等下一个 PR。
  /^tests\/ux\/real-media-fixtures(?:\.|$)/,
  /^tests\/ux\/fixtures\/realMedia\.mjs$/,
]

// Files that define the performance gate's own instrument: the benchmark that
// holds PERFORMANCE_BUDGETS and the platform calibration, the verdict applier,
// and this policy (which decides whether the perf lane runs at all). Editing the
// instrument must re-run the instrument on main code so a budget/calibration
// change is validated against a known baseline before it can merge — otherwise a
// mis-tuned ceiling ships unverified. These override the general validation-
// infrastructure carve-out (which normally suppresses the perf lane to keep
// runner variance from blocking unrelated infra changes).
const PERFORMANCE_INSTRUMENT_PATTERNS = [
  /^tests\/ux\/canvas-performance-benchmark(?:\.|$)/,
  /^scripts\/(?:canvas-performance-verdict|validation-policy)(?:\.|$)/,
]

function normalizePath(file) {
  return String(file || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
}

function normalizeEntries(changedFiles) {
  return changedFiles.map((entry) =>
    typeof entry === 'string'
      ? { status: 'M', path: normalizePath(entry) }
      : { status: String(entry.status || 'M'), path: normalizePath(entry.path) },
  )
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => pattern.test(path))
}

// 每条 lane 只许往上抬、不许被后面的文件压回去：分档是「整个 diff 里风险最高的那个文件」决定的，
// 与文件在 diff 里的先后无关。canvas 是唯一的多档 lane（none < critical < full），
// 2026-09-22 之前它是直接赋值——reactFlow/ 文件先抬到 full，排在后面的普通画布文件又把它写回 critical，
// PR #833（改了 reactFlow 把手层级）因此跳过了 Canvas Acceptance，回归在 main 上才被下一个 PR 撞出来。
const CANVAS_LEVELS = Object.freeze(['none', 'critical', 'full'])

function raiseCanvas(policy, level) {
  if (CANVAS_LEVELS.indexOf(level) > CANVAS_LEVELS.indexOf(policy.canvas)) policy.canvas = level
}

function failClosed(files, reason, { release = false } = {}) {
  return {
    ...FULL_POLICY,
    release,
    failClosed: true,
    reason,
    reasons: [reason],
    files,
  }
}

export function classifyValidationPolicy(changedFiles, options = {}) {
  const files = normalizeEntries(changedFiles)
  const eventName = options.eventName || 'pull_request'
  const requestedMode = options.requestedMode || ''

  if (requestedMode === 'full') return failClosed(files, 'explicit_full_validation', { release: true })
  if (eventName === 'workflow_dispatch') {
    return failClosed(files, 'workflow_dispatch_release_boundary', { release: true })
  }
  if (files.length === 0) return failClosed(files, 'empty_diff_fail_closed')
  // Prove the whole diff is documentation before exempting deletion uncertainty.
  // Image extensions alone cannot distinguish docs from shipped/test assets;
  // renames retain fail-closed because an entry may omit the source path.
  const docsOnly = files.every(({ path, status }) =>
    /^(?:A|M|D)$/.test(status) && DOCS_ONLY_PATTERN.test(path),
  )
  const validationInfrastructure = files.filter((entry) =>
    matchesAny(entry.path, VALIDATION_INFRASTRUCTURE_PATTERNS),
  )
  const webSurface = files.filter((entry) => matchesAny(entry.path, WEB_SURFACE_PATTERNS))
  // 비-문서 파일이 전부 web 뿐인 diff → web 서피스 프로파일(데스크톱 레인을 올리지 않음).
  const webOnly = !docsOnly && webSurface.length > 0 && files.every(
    (entry) => DOCS_ONLY_PATTERN.test(entry.path) || matchesAny(entry.path, WEB_SURFACE_PATTERNS),
  )
  // 삭제(`D`)는 지운 경로 자체를 담는다. 소비자가 같은 면 안에만 있는 경로의 삭제는 다른 면의
  // 런타임 소비자를 고립시킬 수 없다:
  //   · 문서(docs/·marketing/·README*·AGENTS.md·CLAUDE.md)는 런타임이 읽지 않고, 참조 dangling은
  //     contracts의 check:docs-index / check:doc-status / check:site가 잡으며 docs-autosync가 보정한다.
  //   · web/은 역방향 의존이 0건이라 web 테스트와 tsc가 그 면 안에서 잡는다(개인 웹 워크플로).
  // rename(`R`)은 원본 경로를 빠뜨릴 수 있어(gitNameStatus가 새 경로만 남긴다: `src/foo.ts → docs/foo.md`가
  // 문서처럼 보인다) 그대로 fail-closed로 둔다. 생산·테스트·CI·미인식 경로 삭제도 그대로 fail-closed.
  // (2026-09-08 계약을 대체: docs/fixes/2026-10-13-deletion-scope-same-surface.root-cause.json)
  const deletionStaysWithinItsSurface = (path) =>
    DOCS_ONLY_PATTERN.test(path) || matchesAny(path, WEB_SURFACE_PATTERNS)
  const ambiguousStructuralChange = files.find(
    (entry) =>
      (entry.status.startsWith('R') ||
        (entry.status.startsWith('D') && !deletionStaysWithinItsSurface(entry.path))) &&
      !docsOnly &&
      !matchesAny(entry.path, VALIDATION_INFRASTRUCTURE_PATTERNS),
  )
  if (ambiguousStructuralChange) {
    return failClosed(files, 'deletion_or_rename_fail_closed')
  }
  if (!docsOnly) {
    const unrecognized = files.find((entry) =>
      !DOCS_ONLY_PATTERN.test(entry.path)
      && !matchesAny(entry.path, RECOGNIZED_ROOT_PATTERNS)
      && !matchesAny(entry.path, VALIDATION_INFRASTRUCTURE_PATTERNS)
      && !matchesAny(entry.path, PACKAGE_PATTERNS))
    if (unrecognized) return failClosed(files, `unrecognized_path_fail_closed:${unrecognized.path}`)
  }
  // webOnly · isolated · docs_only 가 공유하는 기본 면(포커스드 단위 + 핵심 스모크, 데스크톱 면 없음).
  const focusedSurfaces = {
    coreSmoke: !docsOnly,
    unit: 'focused',
    desktop: false,
    journeys: false,
    canvas: 'none',
    performance: false,
    package: false,
    release: false,
    failClosed: false,
  }
  const policy = validationInfrastructure.length > 0
    ? {
        ...VALIDATION_INFRASTRUCTURE_POLICY,
        release: false,
        failClosed: true,
        reason: `validation_infrastructure:${validationInfrastructure[0].path}`,
        reasons: [`validation_infrastructure:${validationInfrastructure[0].path}`],
        files,
      }
    : webOnly
      ? {
          // web 서피스 프로파일: 계약 + 핵심 스모크 + (루트 vitest 가 web 을 포함하지 않으므로 사실상 no-op 인)
          // focused 단위 레인만. 데스크톱 전용인 Electron 워크스루·캔버스 인수·성능·패키징은 올리지 않는다.
          ...focusedSurfaces,
          reason: `web_surface:${webSurface[0].path}`,
          reasons: [`web_surface:${webSurface[0].path}`],
          files,
        }
      : {
          ...focusedSurfaces,
          reason: docsOnly ? 'docs_only' : 'isolated_change',
          reasons: [],
          files,
        }

  for (const { path } of files) {
    if (matchesAny(path, PERFORMANCE_INSTRUMENT_PATTERNS)) {
      policy.unit = 'full'
      policy.desktop = true
      raiseCanvas(policy, 'full')
      policy.performance = true
      policy.reasons.push(`performance-instrument:${path}`)
    }
    if (matchesAny(path, VALIDATION_INFRASTRUCTURE_PATTERNS)) continue
    // web 경로는 어느 데스크톱 레인도 올리지 않는다(web+electron 혼합 diff 에서도 Electron 쪽이
    // 올린 만큼만 남는다 — 단조 상승). web 만 바꾼 diff 는 위 webOnly 분기가 이미 처리한다.
    if (matchesAny(path, WEB_SURFACE_PATTERNS)) continue
    if (path.startsWith('electron/')) {
      policy.unit = 'full'
      policy.desktop = true
      policy.reasons.push(`electron:${path}`)
    }
    if (matchesAny(path, JOURNEY_PATTERNS)) {
      policy.unit = 'full'
      policy.journeys = true
      policy.reasons.push(`journey:${path}`)
    }
    if (matchesAny(path, DESKTOP_PATTERNS)) {
      policy.unit = 'full'
      policy.desktop = true
      policy.reasons.push(`desktop:${path}`)
    }
    if (matchesAny(path, CANVAS_PATTERNS)) {
      policy.unit = 'full'
      raiseCanvas(policy, matchesAny(path, FULL_CANVAS_PATTERNS) ? 'full' : 'critical')
      policy.reasons.push(`canvas:${path}`)
    }
    if (matchesAny(path, PERFORMANCE_PATTERNS)) {
      policy.unit = 'full'
      policy.desktop = true
      raiseCanvas(policy, 'full')
      policy.performance = true
      policy.reasons.push(`performance:${path}`)
    }
    if (matchesAny(path, PACKAGE_PATTERNS)) {
      policy.unit = 'full'
      policy.desktop = true
      policy.package = true
      policy.reasons.push(`package:${path}`)
    }
  }

  policy.reasons = [...new Set(policy.reasons)]
  if (policy.reasons.length > 0) policy.reason = policy.reasons[0]
  return policy
}

export const VALIDATION_POLICY_OUTPUTS = Object.freeze([
  'coreSmoke',
  'unit',
  'desktop',
  'journeys',
  'canvas',
  'performance',
  'package',
  'release',
  'failClosed',
])
