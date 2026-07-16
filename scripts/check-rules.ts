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

if (failed) {
	process.exit(1);
}
console.log("check-rules: all checks passed");
