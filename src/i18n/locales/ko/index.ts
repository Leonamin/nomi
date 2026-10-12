import { getDesktopBridge } from '../../../desktop/bridge'
import type { TranslationShape, zhCN } from '../../resources'
import shotTable from './shotTable.json'
import common from './common.json'
import media from './media.json'
import brand from './brand.json'
import theme from './theme.json'
import about from './about.json'
import updaterDialog from './updaterDialog.json'
import taskCenter from './taskCenter.json'
import appBar from './appBar.json'
import window from './window.json'
import router from './router.json'
import workspace from './workspace.json'
import library from './library.json'
import errors from './errors.json'
import connection from './connection.json'
import studio from './studio.json'
import onboarding from './onboarding.json'
import sidebar from './sidebar.json'
import canvas from './canvas.json'
import modelSetup from './modelSetup.json'
import browserAssets from './browserAssets.json'
import timelinePreview from './timelinePreview.json'
import previewSource from './previewSource.json'
import assetLibrary from './assetLibrary.json'
import settings from './settings.json'
import onboardingProviders from './onboardingProviders.json'
import antigravity from './antigravity.json'
import comfyuiWorkflowPage from './comfyuiWorkflowPage.json'
import libraries from './libraries.json'
import director from './director.json'
import timelineEditor from './timelineEditor.json'
import creationAi from './creationAi.json'
import storyboardEditor from './storyboardEditor.json'
import generationCommon from './generationCommon.json'
import runtime from './runtime.json'
import videoDepth from './videoDepth.json'
import agentResident from './agentResident.json'
import community from './community.json'
import feedbackReport from './feedbackReport.json'
import agentPanelV4 from './agentPanelV4.json'
import agentLaneError from './agentLaneError.json'
import agentToolFailure from './agentToolFailure.json'

const base = {
  shotTable,
  common,
  media,
  brand,
  theme,
  about,
  updaterDialog,
  taskCenter,
  appBar,
  window,
  router,
  workspace,
  library,
  errors,
  connection,
  studio,
  onboarding,
  sidebar,
  canvas,
  modelSetup,
  browserAssets,
  timelinePreview,
  previewSource,
  assetLibrary,
  settings,
  onboardingProviders,
  antigravity,
  comfyuiWorkflowPage,
  libraries,
  director,
  timelineEditor,
  creationAi,
  storyboardEditor,
  generationCommon,
  runtime,
  videoDepth,
  agentResident,
  community,
  feedbackReport,
  agentPanelV4,
  agentLaneError,
  agentToolFailure
} satisfies TranslationShape<typeof zhCN>

// The personal web host offers manual ComfyUI generation and stores files on the server.
// Keep desktop copy intact while explaining the web host's actual capabilities.
export const ko = getDesktopBridge()?.platform === 'web' ? {
  ...base,
  library: {
    ...base.library,
    local: '서버에 저장됨',
    textModelMissing: '이 웹에서는 AI 자동 제작을 제공하지 않아요',
    textModelMissingHint: '연결된 ComfyUI 모델로 직접 이미지와 영상을 만들 수 있어요.',
    connectTextModel: '연결된 모델 보기',
  },
  onboarding: {
    ...base.onboarding,
    steps: {
      ...base.onboarding.steps,
      model: { label: '연결된 모델 확인', hint: 'ComfyUI 모델이 없다면 운영자에게 연결을 확인해 달라고 요청하세요.' },
      storyboard: { label: '장면 설명 적기', hint: '생성 화면에 이미지 카드를 추가하고 만들고 싶은 장면을 적어 주세요.' },
      generated: { label: '이미지 만들기', hint: '카드에서 연결된 ComfyUI 모델을 고르고 생성하세요.' },
    },
  },
} satisfies TranslationShape<typeof zhCN> : base
