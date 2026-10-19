# Generated audio node → timeline adoption

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


改动名：生成音频入音轨与时长　线/负责人：sol_implementation　类别：[可打断]

| 格 | 结论 | 证据 |
|---|---|---|
| ★1 用户怎么用 | 创建者在 Web 已生成一段旁白后点节点「加入时间轴」，音频应进 audioTrack，长度贴合音源，再与图片/视频一起预览和导出。真实任务：① 项目 project-1792053115776-7yag5i 的 gen-v2-audio-mv9a7oe5-lpw5（3.244603 秒）快加；② 同节点拖到音轨；③ 与已有图片/音乐混排后 MP4 导出。既有错误 imageTrack/90 帧不能代表音频。旧的 categoryId=audio 图片占位仍按音频处理；不自动改写既有错轨剪辑。 | 生产 QA 数据与复现；本次 red 测试 |
| ★2 谁说了算 | 生成节点→剪辑类型及已有时长在 buildClipFromGenerationNode 判定；实际文件无已知时长时，异步 buildGenerationNodeTimelineClip 调用既有 readAudioDurationSeconds 测量。按钮采纳和轨道拖拽均收敛前者，按钮/批量采纳收敛后者。单节点异步采纳在入口取得项目生命周期，探测后只重建纯剪辑位置/ID，避免双次媒体解码；贴尾位置从最新轴计算。 | door-map buildClipFromGenerationNode、buildGenerationNodeTimelineClip |
| ★3 一致与复用 | 复用现有 GenerationNodeResult.type、executionKind、media duration probe 与三轨 getTrackTypeForClipType；不新建音轨规则、不改 AssetPicker 已正确的音乐路径。已知 result.durationSeconds 优先于 meta.durationSec；缺少二者才探测文件；选中历史结果时不能借用当前结果的 meta.durationSec，避免已有精确时长时的重复解码。 | buildClipFromGenerationNode.ts；buildGenerationNodeTimelineClip.ts；addAssetToTimeline.ts |
| ★4 全状态 | 有 URL 且结果为音频：audio clip；已知正时长：按 fps 四舍五入；无已知时长：离屏探测，探测失败沿用既有非图片默认 5 秒。无 URL/进行中：不入轴；切换项目：无旧项目回执且不写入；等待期间改轴：贴尾用最新位置，帧率变化则提示轴已变并不写；探测失败：保留 5 秒默认；已有错轨剪辑：保持原样，用户自行移除。UI 文案与视觉不变。 | builder / adoption red-to-green tests |
| 5 中途表 | 无生成新任务或扣费。等待探测时用户停/关窗/切项目：原项目 lifetime 失效，返回不写新项目、无旧项目回执；断网/音频载入失败：8 秒探测上限后 5 秒既有默认，用户可再编辑；重启：尚未提交的动作不持久化；连点：既有 proposal 幂等回执，若轴被用户改过则按真实新落点处理。 | adoptionBridge 取消/并发/重放测试；人工浏览器任务 |
| 6 外部数据与失败 | 输入是用户项目持久音频文件 URL 与生成结果元数据；没有新供应商 API。已知正时长按结果→当前节点元数据，未知才用既有 HTMLAudioElement metadata probe（8 秒超时）。失败保留原先非图片默认时长并在契约列为残余风险，不声称精确。 | src/media/audioDurationProbe.ts；builder/probe tests |
| 7 性能预算 | 实际 3.244603 秒的节点用元数据直接成 97 帧，不触发额外解码；未知时长至多一次 8 秒探测，不再两次串行累计 16 秒。大规模并发采纳尚未测，unverified。 | adoptionBridge 探测次数断言；Web 浏览器 QA |
| 8 真实条件 | 英文/中文 Web 实际项目、键盘快加、7.5 秒 MP4 导出初版源已验证；最终生命周期补丁浏览器复验待协调会话完成。Windows、最小窗口、真规模、干净安装、真付费：unverified；本修改不调用生成付费动作。 | 协调会话 QA 报告；最终构建 |
| ★9 验收与回滚 | 修前红：报告节点生成 image/90；修后同 fixture audio/97、按钮采纳写 audioTrack；category audio placeholder、result.durationSeconds 优先级及无时长 probe 有独立断言。Web typecheck/test/build 与风险选定 gates、正式全测试在最终 commit 检验；独立审查及协调会话 Web 浏览器实际任务验收，含项目切换/并发编辑回归。坏了 revert 本修复 commit。 | docs/archive/qa 本次报告；PR 独立验收 |
