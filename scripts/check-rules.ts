/**
 * Deterministic conformance checks for the rules in CLAUDE.md and
 * .claude/rules/*.md. Run by the Claude Code Stop hook (see
 * .claude/settings.json) and manually via `bun run check:rules`.
 *
 * Only checks that are currently green may live here — a red check would
 * block every turn. Once their Linear issues are fixed, add:
 *   - ColorBadge / PlayerAvatar wrapper bans (SA2-112, SA2-119)
 *   - raw queryClient.setQueryData outside utils helpers (SA2-162)
 */
import { readFile } from "node:fs/promises";
import { Glob } from "bun";

interface Check {
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
		rule: "CLAUDE.md (Vite bundler breaks the namespace import)",
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
		name: "React/library hooks called directly in a component file — move into a use-*.ts hook",
		rule: ".claude/rules/web-hooks-separation.md",
		globs: [
			"apps/web/src/**/components/**/*.tsx",
			"apps/web/src/**/pages/**/*.tsx",
			"apps/web/src/routes/**/*.tsx",
		],
		pattern:
			/\b(useState|useEffect|useMemo|useRef|useCallback|useForm|useQuery|useMutation|useQueryClient|useReducer|useDeferredValue|useTransition|useLayoutEffect|useIsMutating)\b/,
		excludePath: /__tests__|\.test\.tsx$|\/use-[^/]*\.tsx$/,
	},
];

let failed = false;

for (const check of CHECKS) {
	const hits: string[] = [];
	const seen = new Set<string>();
	for (const glob of check.globs) {
		for await (const path of new Glob(glob).scan(".")) {
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
			const lines = text.split("\n");
			for (const [i, line] of lines.entries()) {
				if (check.pattern.test(line) && !check.excludeLine?.test(line)) {
					hits.push(`${path}:${i + 1}: ${line.trim()}`);
				}
			}
			if (hits.length === hitsBefore && !check.excludeLine) {
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
