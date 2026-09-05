import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Glob, spawn, write } from "bun";

const root = path.resolve(import.meta.dirname, "..");
const child = spawn(
	[process.execPath, "x", "vitest", "list", "--filesOnly", "--json"],
	{ cwd: root, stdout: "pipe", stderr: "inherit" }
);
const output = await new Response(child.stdout).text();
if ((await child.exited) !== 0) {
	throw new Error("Vitest discovery failed");
}
const discovered = JSON.parse(output) as {
	file: string;
	projectName: string;
}[];
const normalize = (file: string) =>
	path.relative(root, file).replaceAll("\\", "/");
const assignments = new Map<string, string[]>();
for (const entry of discovered) {
	const file = normalize(entry.file);
	assignments.set(file, [...(assignments.get(file) ?? []), entry.projectName]);
}
const errors: string[] = [];
for await (const file of new Glob(
	"{apps,packages,testing}/**/*.{test,spec}.{ts,tsx}"
).scan(root)) {
	const normalized = file.replaceAll("\\", "/");
	if (normalized.split("/").includes("node_modules")) {
		continue;
	}
	const projects = assignments.get(normalized) ?? [];
	if (projects.length !== 1) {
		errors.push(
			`${normalized}: expected one Vitest project, found ${projects.join(", ") || "none"}`
		);
	}
}
await mkdir(path.join(root, "test-results"), { recursive: true });
await write(
	path.join(root, "test-results/discovery.json"),
	JSON.stringify(discovered, null, 2)
);
if (errors.length) {
	throw new Error(errors.join("\n"));
}
console.log(
	`Discovery: ${discovered.length} test files, no missing or duplicate assignments.`
);
