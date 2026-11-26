import { existsSync } from "node:fs";
import path from "node:path";
import { file, Glob, spawn } from "bun";

interface Manifest {
	scripts?: Record<string, string>;
	workspaces?: { packages?: string[] };
}

const LINE_BREAK = /\r?\n/u;
const PROJECT_ARG = /(?:^|\s)(?:-p|--project)\s+(?<project>\S+)/gu;
const FILTERS_ALL =
	/--filter\s+(?<quote>['"]?)\*\k<quote>\s+check-types(?:\s|$)/u;
const RUNS_TSC = /^tsc(?:\s|$)/u;

const root = path.resolve(import.meta.dirname, "..");
const normalize = (target: string) =>
	path.relative(root, path.resolve(root, target)).replaceAll("\\", "/");
const readManifest = (dir: string): Promise<Manifest> =>
	file(path.join(root, dir, "package.json")).json();

const run = async (command: string[]) => {
	const child = spawn(command, {
		cwd: root,
		stderr: "inherit",
		stdout: "pipe",
	});
	const output = await new Response(child.stdout).text();
	if ((await child.exited) !== 0) {
		throw new Error(`${command.join(" ")} failed`);
	}
	return output.split(LINE_BREAK).filter(Boolean);
};

const projectArgs = (script: string, cwd: string) =>
	[...script.matchAll(PROJECT_ARG)].map((match) =>
		normalize(path.join(cwd, match.groups?.project ?? ""))
	);

const errors: string[] = [];
const rootManifest = await readManifest(".");
const rootScript = rootManifest.scripts?.["check-types"] ?? "";
if (!FILTERS_ALL.test(rootScript)) {
	errors.push(
		"package.json: check-types must run `bun run --filter '*' check-types` so no workspace is left out"
	);
}

const sources = (
	await run([
		"git",
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard",
		"--",
		"*.ts",
		"*.tsx",
		"*.mts",
		"*.cts",
	])
)
	.map(normalize)
	.filter((source) => existsSync(path.join(root, source)));

const workspaceDirs = (
	await Promise.all(
		(rootManifest.workspaces?.packages ?? []).map((pattern) =>
			Array.fromAsync(new Glob(`${pattern}/package.json`).scan(root))
		)
	)
)
	.flat()
	.map((manifestPath) => normalize(path.dirname(manifestPath)))
	.filter((dir) => sources.some((source) => source.startsWith(`${dir}/`)));
const workspaceManifests = await Promise.all(workspaceDirs.map(readManifest));

const projects = projectArgs(rootScript, ".");
for (const [index, dir] of workspaceDirs.entries()) {
	const script = workspaceManifests[index]?.scripts?.["check-types"];
	if (!(script && RUNS_TSC.test(script))) {
		errors.push(
			`${dir}: contains TypeScript but has no tsc-based check-types script, so the root check-types skips it`
		);
		continue;
	}
	const explicit = projectArgs(script, dir);
	projects.push(...(explicit.length ? explicit : [dir]));
}

const listings = await Promise.all(
	projects.map((project) =>
		run([process.execPath, "x", "tsc", "--listFilesOnly", "-p", project])
	)
);
const covered = new Set(listings.flat().map(normalize));
for (const source of sources) {
	if (!covered.has(source)) {
		errors.push(
			`${source}: not part of any project that check-types runs (${projects.join(", ")})`
		);
	}
}

if (errors.length) {
	throw new Error(errors.join("\n"));
}
console.log(
	`Type coverage: ${sources.length} TypeScript files across ${projects.length} projects, none unchecked.`
);
