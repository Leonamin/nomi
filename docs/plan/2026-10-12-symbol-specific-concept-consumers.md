# Symbol-specific concept consumers

Implementation line: project_ports. Category: other (governance precision; no GPU dispatch or user UI).

| Design card | Decision / evidence |
|---|---|
| 1 User task | Register exactly the three approved historical web symbols without admitting another symbol in the same files. Actual origin/main source proof is in the approved scanner migration. No whole-file approval is requested. |
| 2 Owner | Existing concept-owners-lib validateRegistry/sanitizeConcepts/evaluateDoorPolicy owns consumer validation and matching. Exact `{path,symbol}` complements existing string records. Pending write history remains evaluateBaseline/evaluateHistory; neither changes. |
| 3 Reuse | Keep one existing checker/registry and AST-generated actual doors. Retain existing string consumer behavior. No parallel approval list or vendor special cases. |
| 4 States | Valid exact record: matching path and actual door symbol accepted. Other symbol/path, malformed record, extra fields: rejected. Existing strings unchanged. No product UI. |
| 9 Acceptance / rollback | Characteristic tests prove matching exact reader/writer, same-file fourth reader/writer rejection, malformed records rejection and frozen new write rejection even with an exact consumer. Node checker tests + root contracts; independent coordinator reviews source and final registry tuples. Revert only this precision commit if needed. |

Root classification: recurring. The schema currently represents a consumer only as a file; exact symbol approval cannot be represented. Earliest shared boundary is consumer validation/sanitization plus evaluateDoorPolicy, not caller paths. This narrows a newly registered exception to an exact generated door. It does not permit new history/baseline entries, change original guards, or broaden existing file consumer entries.
