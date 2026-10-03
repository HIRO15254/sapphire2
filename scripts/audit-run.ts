import { spawnSync } from "node:child_process";

export type AuditAgent = "claude" | "codex";
export type AuditTask = "audit" | "ui-patrol";

export interface AuditCommand {
	args: string[];
	command: string;
	input: string;
}

const RUNS: Record<AuditAgent, { args: string[]; command: string }> = {
	claude: {
		command: "claude",
		args: [
			"-p",
			"--model",
			"opus",
			"--effort",
			"xhigh",
			"--dangerously-skip-permissions",
		],
	},
	codex: {
		command: "codex",
		args: [
			"exec",
			"-m",
			"gpt-5.6-sol",
			"-c",
			"model_reasoning_effort=xhigh",
			"--dangerously-bypass-approvals-and-sandbox",
			"-",
		],
	},
};

export function isAuditAgent(value: string | undefined): value is AuditAgent {
	return value === "claude" || value === "codex";
}

export function isAuditTask(value: string | undefined): value is AuditTask {
	return value === "audit" || value === "ui-patrol";
}

export function buildAuditCommand(
	agent: AuditAgent,
	task: AuditTask = "audit"
): AuditCommand {
	return {
		...RUNS[agent],
		input: `You are the ${agent} agent. Read and follow .claude/skills/${task}/SKILL.md exactly, starting from step 1. Your agent name is ${agent}.\n`,
	};
}

function main(args: string[]): void {
	const [agent, task = "audit"] = args.filter((arg) => arg !== "--dry-run");
	if (!(isAuditAgent(agent) && isAuditTask(task))) {
		console.error(
			"usage: audit-run.ts claude|codex [audit|ui-patrol] [--dry-run]"
		);
		process.exit(2);
	}
	const run = buildAuditCommand(agent, task);
	if (args.includes("--dry-run")) {
		console.log([run.command, ...run.args].join(" "));
		console.log(run.input);
		return;
	}
	const result = spawnSync(run.command, run.args, {
		input: run.input,
		stdio: ["pipe", "inherit", "inherit"],
		shell: process.platform === "win32",
	});
	if (result.error) {
		console.error(
			`audit-run: could not start ${run.command}: ${result.error.message}`
		);
	}
	process.exit(result.status ?? 1);
}

if (import.meta.main) {
	main(process.argv.slice(2));
}
