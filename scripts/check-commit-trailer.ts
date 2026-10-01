import { readFileSync } from "node:fs";

interface Agent {
	example: string;
	name: string;
	trailer: RegExp;
}

const CLAUDE: Agent = {
	name: "Claude Code",
	trailer: /^co-authored-by: claude[^<\n]*<noreply@anthropic\.com>\r?$/im,
	example: "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
};

const CODEX: Agent = {
	name: "Codex",
	trailer: /^co-authored-by: codex \([^)\n]+\) <noreply@openai\.com>\r?$/im,
	example: "Co-Authored-By: Codex (gpt-5.5) <noreply@openai.com>",
};

const GEMINI: Agent = {
	name: "Gemini CLI",
	trailer:
		/^co-authored-by: gemini cli \([^)\n]+\) <noreply@google\.com>\r?$/im,
	example: "Co-Authored-By: Gemini CLI (gemini-3-pro) <noreply@google.com>",
};

type Env = Record<string, string | undefined>;

export function detectAgents(env: Env): Agent[] {
	const agents: Agent[] = [];
	if (env.CLAUDECODE === "1") {
		agents.push(CLAUDE);
	}
	if (
		env.CODEX_MANAGED_PACKAGE_ROOT !== undefined ||
		Object.keys(env).some((key) => key.startsWith("CODEX_MANAGED_BY_"))
	) {
		agents.push(CODEX);
	}
	if (env.GEMINI_CLI === "1") {
		agents.push(GEMINI);
	}
	return agents;
}

export function missingTrailers(message: string, env: Env): Agent[] {
	return detectAgents(env).filter((agent) => !agent.trailer.test(message));
}

if (import.meta.main) {
	const [messageFile] = process.argv.slice(2);
	if (!messageFile) {
		console.error("check-commit-trailer: pass the commit message file.");
		process.exit(2);
	}
	const missing = missingTrailers(
		readFileSync(messageFile, "utf8"),
		process.env
	);
	for (const agent of missing) {
		console.error(
			`check-commit-trailer: commits made by ${agent.name} must end with its trailer, e.g. "${agent.example}".`
		);
	}
	if (missing.length > 0) {
		process.exit(1);
	}
}
