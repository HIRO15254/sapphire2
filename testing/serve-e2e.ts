import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Log, Miniflare } from "miniflare";
import { applyMigrations } from "../packages/api/src/__integration__/test-database.ts";
import { readWorkerCompatibility } from "./worker-compatibility.ts";

const root = path.resolve(import.meta.dirname, "..");
const runtime = path.join(root, ".test-runtime");
const webDirectory = path.join(runtime, "web");
const workerDirectory = path.join(runtime, "worker");
const resultsDirectory = path.join(root, "test-results");
const workerLog = path.join(resultsDirectory, "worker.log");
const webUrl = "https://localhost:13001";
const apiUrl = "https://localhost:18787";
const { compatibilityDate, compatibilityFlags } = readWorkerCompatibility();

await mkdir(runtime, { recursive: true });
await mkdir(resultsDirectory, { recursive: true });
await writeFile(workerLog, "");
// Vite empties this build output. Never resolve it outside the test directory.
if (path.relative(runtime, webDirectory) !== "web") {
	throw new Error("Unexpected test build output directory");
}

class TestLog extends Log {
	protected override log(message: string): void {
		appendFileSync(workerLog, `${message}\n`);
		super.log(message);
	}
}
const configPath = path.join(runtime, "wrangler.json");
await writeFile(
	configPath,
	JSON.stringify({
		name: "sapphire2-test",
		main: path.join(root, "apps/server/src/worker.ts"),
		compatibility_date: compatibilityDate,
		compatibility_flags: compatibilityFlags,
	})
);

async function build(command: [string, ...string[]], cwd = root) {
	const child = spawn(command[0], command.slice(1), {
		cwd,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			WRANGLER_SEND_METRICS: "false",
			VITE_SERVER_URL: apiUrl,
			VITE_PREVIEW_AUTO_LOGIN: "false",
		},
	});
	child.stdout.on("data", (chunk) => {
		appendFileSync(workerLog, chunk);
		process.stdout.write(chunk);
	});
	child.stderr.on("data", (chunk) => {
		appendFileSync(workerLog, chunk);
		process.stderr.write(chunk);
	});
	const exitCode = await new Promise<number | null>((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", resolve);
	});
	if (exitCode !== 0) {
		throw new Error(`Test build failed: ${command.join(" ")}`);
	}
}

await build([
	"node",
	path.join(root, "node_modules/wrangler/bin/wrangler.js"),
	"deploy",
	"--dry-run",
	"--config",
	configPath,
	"--outdir",
	workerDirectory,
]);
await build(
	[
		process.execPath,
		path.join(root, "apps/web/node_modules/vite/bin/vite.js"),
		"build",
		"--mode",
		"test",
		"--outDir",
		webDirectory,
		"--emptyOutDir",
	],
	path.join(root, "apps/web")
);

const api = new Miniflare({
	log: new TestLog(),
	name: "sapphire2-test-api",
	modules: [
		{ type: "ESModule", path: path.join(workerDirectory, "worker.js") },
	],
	compatibilityDate,
	compatibilityFlags,
	host: "127.0.0.1",
	port: 18_787,
	https: true,
	cf: false,
	d1Databases: ["DB"],
	bindings: {
		BETTER_AUTH_SECRET: "local-test-secret-with-at-least-32-characters",
		BETTER_AUTH_URL: apiUrl,
		CORS_ORIGIN: webUrl,
	},
	outboundService: () =>
		new Response("Unexpected external request in test", { status: 502 }),
});
let web: Miniflare | undefined;

try {
	await applyMigrations(await api.getD1Database("DB"));
	web = new Miniflare({
		log: new TestLog(),
		name: "sapphire2-test-web",
		modules: true,
		script:
			"export default {fetch() {return new Response(null, {status: 404})}}",
		compatibilityDate,
		host: "127.0.0.1",
		port: 13_001,
		https: true,
		cf: false,
		assets: {
			directory: webDirectory,
			routerConfig: { has_user_worker: false },
			assetConfig: { not_found_handling: "single-page-application" },
		},
	});
	await web.ready;
	console.log(`Test environment ready: ${webUrl} → ${apiUrl}`);
	await new Promise<void>((resolve) => {
		process.once("SIGINT", resolve);
		process.once("SIGTERM", resolve);
	});
} finally {
	await Promise.all([web?.dispose(), api.dispose()]);
}
