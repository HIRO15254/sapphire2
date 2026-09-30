# PR review — focused discovery and evidence

Review the supplied committed range. Read AGENTS.md and only the rule files applying to changed paths. The author intent is the commit message for this range. Review only; do not edit product files or post unless explicitly instructed. A full review covers the supplied range; an incremental review covers changes since the last reviewed SHA and checks previous findings first.

## Discover

Use one reviewer context. Do not launch generic hunk, journey, or rule agents. Start with the diff and changed functions; follow relevant callers, handlers and schemas. Skip mechanical lint/type/rule checks already covered by CI.

For changed guards, defaults, filters, mappings or deleted hooks/routes, enumerate the affected inputs and entry points with focused searches. Include untouched callers that still reach the changed behavior. In a removed authentication continuation, search all calls that create a session, including multiline call syntax, preview/background entry points, signup and social login; do not stop at the login form.

For each changed aggregate, compare the contributing rows and units of related outputs. Distinguish missing from zero, absent from explicitly supplied, finished from live, cash from tournament, currency from BB. Check empty and mixed populations only where they exercise changed behavior. A numeric difference is a candidate only if the public contract or intended use requires equality/comparability.

If API/MCP descriptions, schemas, or their handlers change, make a compact internal claim ledger: each changed factual claim → implementing handler/schema → supported / contradicted / unsettled. Check required/optional fields, response shape, overwrite/merge behavior, contributing rows, units and defaults. Claims left unchecked must be disclosed as coverage gaps. Do not add an agent for the same task.

Record every concrete candidate with all affected locations before judging it. Merge by root cause but retain distinct entry points and their individual status. Do not require a minimum finding count or manufacture issues to fill the report.

## Verify candidates

Validate in the same context by actively seeking counterevidence: relevant callers, existing guards, intended compatibility behavior, library implementation, and tests. A file/line citation by itself is not proof that the behavior is erroneous.

Each candidate needs two separate answers:
1. Can a reachable input produce the reported behavior? Cite the actual code path or a targeted execution.
2. Why is that behavior wrong for this change? Cite a concrete promised behavior, input contract or harmful consequence. Read the established semantics, including relevant design rationale and callers, before interpreting ambiguous words in the commit message. Intentionally computed observations and defaults are not automatically missing data. A matching field name in two APIs does not by itself promise identical semantics, and a scoped fix does not by itself promise to change every other API. Mark an incomplete fix only when a demonstrated path violates the behavior this change promises. If intent is unsettled, report a question rather than an important defect.

Trace a proposed counterexample from the public input or persisted data through upstream mapping to the changed function. A hand-built helper input that public callers cannot produce is not proof of a production failure. Existing tests can prove behavior but cannot alone establish that it is correct or incorrect. For population differences, distinguish a false wording claim from a reachable difference in numerical output and explain any actual consequence.

Read library source or run the narrow relevant test for library claims. For claims about a test detecting a regression, execute the test and verify that it ran; zero selected tests, all skipped, or a nonexistent `-t` name are not verification. Never present a proposed command as executed. Run only scoped Vitest projects; no full suite, installations, build, lint or blanket type-checking during review.

Rules guide intent but do not override observable runtime behavior. If a rule contradicts the installed dependency, give both citations and leave the policy conflict unresolved. Do not force numerical confidence scores. Do not call missing tests an important production defect unless a concrete failure is established.

If a candidate cannot be settled after focused source reading and at most two relevant test commands, return it as unverified with the missing evidence. Do not create validators or repeat the whole review. New findings, incomplete fixes, and pre-existing problems have separate labels; do not inflate new-regression counts with the latter two.

## Report

Return Japanese, no more than 40 lines. Important means a demonstrated user/client failure, incorrect result, data loss/corruption or security gap. Nits are nonblocking and appear only in the summary, at most three. Unverified questions are nonblocking. Intentional behavior with no demonstrated harm is omitted.

Use a table with tier, scope (new / incomplete-fix / pre-existing), every affected file:line, the scenario, and evidence. Include nits and unverified questions in this table, not in prose supplements. An uncertain contract interpretation is unverified, not important. Omit harmless implementation leftovers. Empty findings is valid. Do not precede the table with a general assurance that contracts are correct. Add one concise coverage line including any unverified or unchecked areas and the targeted tests actually executed with selected/pass/fail counts. Mark an interrupted or incomplete review as incomplete rather than approve.

For compatibility with the PR workflow, end with:
<!-- pr-review: {"verdict":"approve","important":0,"nit":0,"unverified":0,"resolved":[]} -->

Use changes-requested only for established important issues. In incremental mode, resolve a previous finding only when its recorded path is fixed; rejected or unverified findings are not marked resolved. No posting in evaluation runs.
