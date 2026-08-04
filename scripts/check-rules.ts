/**
 * Deterministic conformance checks for the rules in AGENTS.md and
 * .claude/rules/*.md. Run in CI (.github/workflows/ci.yml), by the Claude
 * Code Stop hook (see .claude/settings.json), and manually via
 * `bun run check:rules`.
 *
 * Only checks that are currently green may live here — a red check would
 * block every turn. Once their Linear issues are fixed, add:
 *   - ColorBadge / PlayerAvatar wrapper bans (SA2-112, SA2-119)
 */
import { readFile } from "node:fs/promises";
import { Glob } from "bun";

import { normalizeRulePath } from "./check-rules-path";

interface Check {
	cwd?: string;
	excludeLine?: RegExp;
	excludePath?: RegExp;
	globs: string[];
	name: string;
	pattern: RegExp;
	rule: string;
}

const IGNORED_DIRS = /(^|\/)(node_modules|dist|\.wrangler|coverage|\.git)\//;

const CHECKS: Check[] = [
	{
		name: 'named zod import — use `import z from "zod"`',
		rule: "AGENTS.md (Vite bundler breaks the namespace import)",
		globs: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
		pattern: /import \{ z \} from "zod"/,
	},
	{
		name: "lucide-react import — use @tabler/icons-react",
		rule: ".claude/rules/web-ui.md",
		globs: ["apps/web/src/**/*.{ts,tsx}"],
		pattern: /from "lucide-react"|require\("lucide-react"\)/,
	},
	{
		name: "hsl(var(--token)) — tokens already include the hsl() wrapper",
		rule: ".claude/rules/web-theme.md",
		globs: ["apps/web/src/**/*.{ts,tsx,css}"],
		pattern: /hsl\(var\(/,
		excludeLine: /never hsl/,
	},
	{
		name: '<input type="number"> — use type="text" inputMode="numeric"',
		rule: ".claude/rules/web-forms.md",
		globs: ["apps/web/src/**/*.tsx"],
		pattern: /<[Ii]nput[^>]*type="number"/,
		excludePath: /__tests__|\.test\./,
	},
	{
		name: "Number.parseInt in web input handling — validate the whole value with Number()",
		rule: ".claude/rules/web-forms.md (SA2-103)",
		globs: ["apps/web/src/**/*.{ts,tsx}"],
		pattern: /Number\.parseInt\(/,
		excludePath: /__tests__|\.test\./,
	},
	{
		name: "React/library hooks called directly in a component file — move into a use-*.ts hook",
		rule: ".claude/rules/web-hooks-separation.md",
		globs: [
			"apps/web/src/**/components/**/*.tsx",
			"apps/web/src/**/pages/**/*.tsx",
			"apps/web/src/routes/**/*.tsx",
		],
		pattern:
			/\b(useState|useEffect|useMemo|useRef|useCallback|useForm|useQuery|useMutation|useQueryClient|useReducer|useDeferredValue|useTransition|useLayoutEffect|useIsMutating)\b/,
		excludePath: /__tests__|\.test\.tsx$|[\\/]use-[^\\/]*\.tsx$/,
	},
	{
		name: "raw queryClient cache write in a feature — use optimistic-update helpers",
		rule: ".claude/rules/web-data-fetching.md (SA2-162)",
		globs: ["apps/web/src/features/**/*.{ts,tsx}"],
		pattern: /queryClient\.(setQueryData|setQueriesData)\b/,
		excludePath: /__tests__|\.test\./,
	},
	{
		name: "session-event append pre-read — allocate order inside the INSERT",
		rule: ".claude/rules/api-data-integrity.md (SA2-196)",
		globs: ["packages/api/src/**/*.ts"],
		pattern:
			/max\s*\(\s*sessionEvent\.sortOrder\s*\)|orderBy\(desc\(sessionEvent\.sortOrder\)\)[\s\S]{0,300}\+\s*1|nextAppendSortOrder(?!Sql)\s*\(/,
		excludePath: /__tests__|\.test\./,
	},
	{
		// クォート付きの `claude-*` リテラルを丸ごと禁止する。世代名の列挙だと
		// 旧形式（claude-3-5-sonnet-20241022 のように claude- の直後が数字）を
		// 取りこぼす。クォート必須なので .claude/rules/... のようなパス文字列や
		// 散文中の claude-* には当たらない。ワークフロー YAML は対象外 —
		// pre-merge-review.yml の `--model opus` は可動エイリアスで、
		// 常に最新 Opus を指すため固定 ID の管理対象ではない。
		name: "inline Claude model id — import it from packages/api/src/ai/models.ts",
		rule: ".claude/rules/ai-models.md",
		globs: [
			"apps/**/*.{ts,tsx}",
			"packages/**/*.{ts,tsx}",
			"scripts/**/*.{ts,tsx}",
		],
		pattern: /["'`]claude-[\dA-Za-z._-]+["'`]/,
		excludePath: /packages\/api\/src\/ai\/models\.ts$/,
	},
	{
		name: "direct DB access in the MCP tool layer — go through appRouter.createCaller",
		rule: ".claude/rules/mcp-tools.md",
		globs: ["packages/mcp/src/**/*.ts"],
		// `@sapphire2/db` の前方一致でバレル import（createDb / schema の再 export）
		// まで塞ぐ。サブパスだけ見ると `from "@sapphire2/db"` が素通りする。
		pattern: /from "drizzle-orm|from "@sapphire2\/db/,
		excludePath: /__tests__|\.test\./,
	},
	{
		name: "GitHub pull-request head ref assigned inside a run script — pass it through step env",
		rule: "GitHub Actions shell-injection prevention",
		cwd: ".github",
		globs: ["workflows/*.yml", "workflows/*.yaml"],
		pattern:
			/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*["']?\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\}\}["']?\s*$/m,
	},
];

let failed = false;

for (const check of CHECKS) {
	const hits: string[] = [];
	const seen = new Set<string>();
	for (const glob of check.globs) {
		const cwd = check.cwd ?? ".";
		for await (const scannedPath of new Glob(glob).scan(cwd)) {
			const path = normalizeRulePath(
				cwd === "." ? scannedPath : `${cwd}/${scannedPath}`
			);
			if (
				seen.has(path) ||
				IGNORED_DIRS.test(path) ||
				check.excludePath?.test(path)
			) {
				continue;
			}
			seen.add(path);
			const text = await readFile(path, "utf8");
			// Multiline patterns (e.g. an <input> whose attributes span lines)
			// match against the whole file; single-line hits are reported per line.
			if (!check.pattern.test(text)) {
				continue;
			}
			const hitsBefore = hits.length;
			let anyLineMatched = false;
			const lines = text.split("\n");
			for (const [i, line] of lines.entries()) {
				if (!check.pattern.test(line)) {
					continue;
				}
				anyLineMatched = true;
				if (!check.excludeLine?.test(line)) {
					hits.push(`${path}:${i + 1}: ${line.trim()}`);
				}
			}
			// The file matched as a whole but no single line did → a genuine
			// multiline violation. Guarding on `!anyLineMatched` (not
			// `!check.excludeLine`) keeps this sound once a check combines an
			// excludeLine with a multiline pattern: an all-excluded file is not
			// reported, but a real cross-line hit still is.
			if (hits.length === hitsBefore && !anyLineMatched) {
				hits.push(`${path}: (multiline match)`);
			}
		}
	}
	if (hits.length > 0) {
		failed = true;
		console.error(`\ncheck-rules FAIL: ${check.name}`);
		console.error(`  rule: ${check.rule}`);
		for (const hit of hits) {
			console.error(`  ${hit}`);
		}
	}
}

/**
 * bun:sqlite specs must be named in ci.yml's `bun test` step.
 *
 * Their bodies sit behind a `skipIfNotBun` guard, so Vitest's Node projects
 * report them as skipped, not failed. A spec that is also missing from the
 * dedicated `bun test` step therefore runs nowhere and reports green — a
 * failure mode prose in .claude/rules/db-migrations.md cannot catch, which is
 * exactly when AGENTS.md ("Procedure for adding a rule", step 5) calls for a
 * check here. Expressed as a cross-file existence assertion rather than a
 * banned pattern, so it does not fit the CHECKS table above.
 */
const BUN_SQLITE_STEP = "Test migrations with Bun SQLite";
// Every workspace, not just packages/db: AGENTS.md colocates tests next to the
// code, so the next bun:sqlite spec plausibly lands in some other __tests__/ —
// apps/server's included. `*` does not cross `/`, so a narrower glob would let
// such a spec escape both this check and the `bun test` step, which is the
// silent-green hole this exists to close.
const BUN_SQLITE_SPEC_GLOBS = [
	"apps/**/__tests__/*.test.ts",
	"packages/**/__tests__/*.test.ts",
];
const SPEC_TOKEN = /(?:apps|packages)\/[^\s\\]+\.test\.ts/g;
const REGEXP_SPECIALS = /[.+?^${}()|[\]]/g;

const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
const afterStepName = ciWorkflow.split(`- name: ${BUN_SQLITE_STEP}`)[1];
const unlisted: string[] = [];

if (afterStepName === undefined) {
	unlisted.push(
		`.github/workflows/ci.yml: step "${BUN_SQLITE_STEP}" not found — rename it here too`
	);
} else {
	// Stop at the next step so a spec named in an unrelated step does not count.
	const stepBody = afterStepName.split(/^\s*- name:/m)[0];
	const listed = [...stepBody.matchAll(SPEC_TOKEN)].map(
		(match) =>
			new RegExp(
				`^${match[0].replace(REGEXP_SPECIALS, "\\$&").replaceAll("*", "[^/]*")}$`
			)
	);
	for (const glob of BUN_SQLITE_SPEC_GLOBS) {
		for await (const scannedPath of new Glob(glob).scan(".")) {
			const path = normalizeRulePath(scannedPath);
			if (IGNORED_DIRS.test(path)) {
				continue;
			}
			const text = await readFile(path, "utf8");
			if (!text.includes("bun:sqlite")) {
				continue;
			}
			if (!listed.some((pattern) => pattern.test(path))) {
				unlisted.push(`${path}: not run by any project — add it to ci.yml`);
			}
		}
	}
}

if (unlisted.length > 0) {
	failed = true;
	console.error(
		`\ncheck-rules FAIL: bun:sqlite spec not listed in ci.yml's "${BUN_SQLITE_STEP}" step`
	);
	console.error("  rule: .claude/rules/db-migrations.md");
	for (const hit of unlisted) {
		console.error(`  ${hit}`);
	}
}

/**
 * Every workflow that seeds a D1 from a master-DB dump must stash the triggers
 * around the restore.
 *
 * A trigger keeps a derived table in sync with *application* writes; a bulk
 * restore is not one, so an armed trigger derives rows the dump already
 * carries. 0049's game_mix compat triggers did exactly that and took
 * db-migrate down with `{"D1_RESET_DO":true}`. preview-deploy.yml was fixed,
 * dev-deploy.yml was not — its seed step is a hand-copied sibling ("mirrors
 * preview-deploy.yml's `is_new_db == 'true'` path"), and a copy is precisely
 * what prose cannot keep in sync. Matching on the restore itself rather than
 * on a workflow allowlist means the next copy of this step is caught too.
 *
 * Each marker is a distinct half of the fix, so they are asserted separately:
 * reading the live DDL back (not re-running a migration), dropping it, and
 * re-arming from ANY state via a drops-then-creates file. A workflow that
 * dropped without re-arming would leave the DB permanently trigger-less.
 */
const SEED_RESTORE_MARKER = "--file=dump.sql";
const TRIGGER_STASH_MARKERS: { hint: string; marker: string }[] = [
	{
		marker: "FROM sqlite_master WHERE type = 'trigger'",
		hint: "read the live trigger DDL back out of sqlite_master",
	},
	{ marker: "DROP TRIGGER IF EXISTS", hint: "drop them for the restore" },
	{
		marker: "rearm-triggers.sql",
		hint: "re-arm from drops-then-creates so it converges from a partial drop",
	},
];

const unstashed: string[] = [];
// `dot: true` is load-bearing: Bun's Glob skips dot-directories by default, so
// without it this scans .github/ into an empty set and reports green forever.
for await (const scannedPath of new Glob("workflows/*.yml").scan({
	cwd: ".github",
	dot: true,
})) {
	const path = normalizeRulePath(`.github/${scannedPath}`);
	const text = await readFile(path, "utf8");
	if (!text.includes(SEED_RESTORE_MARKER)) {
		continue;
	}
	for (const { marker, hint } of TRIGGER_STASH_MARKERS) {
		if (!text.includes(marker)) {
			unstashed.push(`${path}: missing \`${marker}\` — ${hint}`);
		}
	}
}

if (unstashed.length > 0) {
	failed = true;
	console.error(
		`\ncheck-rules FAIL: D1 seed restore (\`${SEED_RESTORE_MARKER}\`) without the trigger stash`
	);
	console.error("  rule: .claude/rules/db-migrations.md");
	for (const hit of unstashed) {
		console.error(`  ${hit}`);
	}
}

if (failed) {
	process.exit(1);
}
console.log("check-rules: all checks passed");
