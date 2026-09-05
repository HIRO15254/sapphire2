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
		name: "Japanese text in agent rule files — write rules in English",
		rule: "AGENTS.md (Communication)",
		globs: ["AGENTS.md", "CLAUDE.md"],
		pattern: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
	},
	{
		name: "Japanese text in agent rule files — write rules in English",
		rule: "AGENTS.md (Communication)",
		cwd: ".claude/rules",
		globs: ["**/*.md"],
		pattern: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
	},
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
		pattern: /from "drizzle-orm|from "@sapphire2\/db/,
		excludePath: /__tests__|\.test\./,
	},
	{
		name: "comment divider / banner line — comments are near-zero, delete it",
		rule: ".claude/rules/comments.md",
		globs: [
			"apps/**/*.{ts,tsx}",
			"packages/**/*.{ts,tsx}",
			"scripts/**/*.{ts,tsx}",
		],
		pattern: /^\s*(?:\{?\/\*+|\/{2,}|\*)\s*\S*[-=*#_~─═]{4,}/m,
		excludePath: /routeTree\.gen\.ts$/,
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

const BUN_SQLITE_STEP = "Test migrations with Bun SQLite";
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

const SESSION_ENTRY_GLOB = "apps/web/src/**/*.{ts,tsx}";
const SESSION_ENTRY_CALL = /authClient\s*\.\s*(signIn|signUp)\b/;
const LOGIN_CONTINUATION_IMPORT = /features\/auth\/utils\/login-continuation/;
const LOGIN_CONTINUATION_SELF = /login-continuation\.ts$/;
const unguardedEntries: string[] = [];

for await (const scannedPath of new Glob(SESSION_ENTRY_GLOB).scan(".")) {
	const path = normalizeRulePath(scannedPath);
	if (
		IGNORED_DIRS.test(path) ||
		LOGIN_CONTINUATION_SELF.test(path) ||
		/__tests__|\.test\./.test(path)
	) {
		continue;
	}
	const text = await readFile(path, "utf8");
	if (!SESSION_ENTRY_CALL.test(text)) {
		continue;
	}
	if (!LOGIN_CONTINUATION_IMPORT.test(text)) {
		unguardedEntries.push(
			`${path}: calls authClient.signIn/signUp without importing login-continuation`
		);
	}
}

if (unguardedEntries.length > 0) {
	failed = true;
	console.error(
		"\ncheck-rules FAIL: session entry point drops a pending MCP authorize query"
	);
	console.error(
		"  rule: docs/design/mcp-and-oauth.md (Web login continuation)"
	);
	for (const hit of unguardedEntries) {
		console.error(`  ${hit}`);
	}
}

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

const COMMENT_POLICY_RULE = ".claude/rules/comments.md";
const COMMENT_GLOBS = [
	"apps/**/*.{ts,tsx}",
	"packages/**/*.{ts,tsx}",
	"scripts/**/*.{ts,tsx}",
];
const COMMENT_EXCLUDE_PATH = /routeTree\.gen\.ts$/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*\/|\*(?![\w([])|\{\/\*)/;
const DIRECTIVE_LINE =
	/biome-ignore|@ts-expect-error|@ts-nocheck|@__PURE__|^\s*\/\/\/\s*<reference\b/;
const NOTE_MARKER_START = /^\s*\/\/\s*NOTE\((ops|rule)\):\s*\S/;
const LINE_COMMENT_START = /^\s*\/\//;

const commentHits: string[] = [];
const commentSeen = new Set<string>();
for (const glob of COMMENT_GLOBS) {
	for await (const scannedPath of new Glob(glob).scan(".")) {
		const path = normalizeRulePath(scannedPath);
		if (
			commentSeen.has(path) ||
			IGNORED_DIRS.test(path) ||
			COMMENT_EXCLUDE_PATH.test(path)
		) {
			continue;
		}
		commentSeen.add(path);
		const text = await readFile(path, "utf8");
		let inNoteRun = false;
		for (const [i, line] of text.split("\n").entries()) {
			if (NOTE_MARKER_START.test(line)) {
				inNoteRun = true;
				continue;
			}
			if (inNoteRun && LINE_COMMENT_START.test(line)) {
				continue;
			}
			inNoteRun = false;
			if (COMMENT_LINE.test(line) && !DIRECTIVE_LINE.test(line)) {
				commentHits.push(`${path}:${i + 1}: ${line.trim()}`);
			}
		}
	}
}

if (commentHits.length > 0) {
	failed = true;
	console.error(
		"\ncheck-rules FAIL: non-whitelisted comment — knowledge belongs in docs/design/ or .claude/rules/"
	);
	console.error(`  rule: ${COMMENT_POLICY_RULE}`);
	for (const hit of commentHits) {
		console.error(`  ${hit}`);
	}
}

if (failed) {
	process.exit(1);
}
console.log("check-rules: all checks passed");
