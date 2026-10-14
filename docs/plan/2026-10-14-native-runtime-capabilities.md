# Native runtime capability contract

Implementation line: opencode_execution; categories: long-running, interruptible.

| Cell | Decision and evidence |
|---|---|
| 1 | Select OpenCode and real model in existing browser, read script, draft, approve GPU generation; unsupported runtime reports failure before launch. Actual QA report owned by coordinator. |
| 2 | Native process adapter owns launch configuration; authenticated installation owns provider credentials. Door map nativeAgentExecutable: one shared owner. |
| 3 | Use Node spawn, runtime version/help/config APIs and PATH; no duplicated authentication or legacy execution fallback. |
| 4 | Empty/discovery/loading/success/errors use existing lane states; cancellation retains abort signal and process group termination; expired tool session fails existing admission. |
| 5 | Before launch: cancel/close/network/restart/repeat cause no provider spend. During launch: abort kills task process group; existing ledger and ProductionRun preserve receipts and approval guards. All five interruptions reuse existing ownership. |
| 6 | Official OpenCode config and v2 source define contract; invalid version/help/config fails closed before model invocation. |
| 7 | Three bounded capability probes per turn; no static provider facts. Actual latency recorded during real run. |
| 8 | Actual Mac v1 reproduces mismatch; actual isolated Mac v2 and browser/GPU proof pending coordinator; Windows unverified. |
| 9 | Independent acceptance line checks launch restrictions and actual task receipts; revert task commit on failure. |

Actual runtime evidence (2026-10-14): official `@opencode/cli@2.0.28` installed under a QA-only prefix, reports `opencode v2.0.28`; global Mac1.18.26 unchanged. Existing installation reports OpenCode Go and OpenRouter stored authentication. A real provider turn through `runNativeAgent`, model `opencode-go/deepseek-v4.1-flash`, returned session `ses_ec74fa91cffeYiI21fHFnyGIcp` and text `OpenCode 실제 실행 확인.` then clean completion. This proves native launch/provider/output projection only; MCP/browser/GPU acceptance remains coordinator-owned. Changed boundary slice:18 tests green; web typecheck green.

Independent review found malformed present info/MCP shapes could be treated as absence. Eight class cases reproduced red, then passed after strict record validation; missing fields remain legitimate.

Resume remediation protocol (approved by coordinator before implementation): start one private authenticated loopback OpenCode server via supported serve --stdio, retain its stdin lease, read its own random port URL, poll the owning mcp.list status within a30-second budget, reject any unrelated enabled server, then run --server against this exact private server with the original saved session ID. Abort/finish closes lease and kills only our process groups. Direct admitted Nomi tools replace Code Mode; no shell execute permission is granted. Actual pre-fix counter evidence: first call1, resumed call still1 with provider reporting catalog removal. Supported protocol prototype: same ses_ec73c2dddffenlRHubS9VB2YGs first call1 and resumed call2; actual Figma disabled.

Final production-adapter certificate: same session ses_ec730d9c0ffeGjGaiEFLIEcfhw firstcounter1 and true resumedcounter2. Both private leases rejected missing and wrong credentials with HTTP401; both owned PIDs exited and ports closed after completion. Sanitized certificate: `/Users/leonamin/.codex/qa/nomi-web/2026-10-14-opencode-runtime/resume-evidence.json`. Pending-discovery timeout and abort tests prove no provider start and owned-lease closure; stderr is drained without logging. Actual consumed capabilities are run --server/--format and serve --stdio/--hostname/--port. Legacy wrong-directory sessions fail visibly before provider calls without session.move side effects or losing history.
