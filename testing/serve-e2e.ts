import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Log, Miniflare } from "miniflare";
import { applyMigrations } from "../packages/api/src/__integration__/test-database.ts";
import {
	readWorkerCompatibility,
	readWorkerVars,
} from "./worker-compatibility.ts";

const root = path.resolve(import.meta.dirname, "..");
const runtime = path.join(root, ".test-runtime");
const webDirectory = path.join(runtime, "web");
const workerDirectory = path.join(runtime, "worker");
const resultsDirectory = path.join(root, "test-results");
const workerLog = path.join(resultsDirectory, "worker.log");
const webUrl = "https://localhost:13001";
const apiUrl = "https://localhost:18787";
const { compatibilityDate, compatibilityFlags } = readWorkerCompatibility();
const apiWorkerName = "sapphire2-test-api";
const edgeScript = `let next = 0;
export default {
	async fetch(request, env) {
		const headers = new Headers(request.headers);
		let clientIp = headers.get("x-test-client-ip");
		if (!clientIp) {
			next += 1;
			clientIp = \`198.18.\${(next >> 8) & 255}.\${next & 255}\`;
		}
		headers.delete("x-test-client-ip");
		headers.set("cf-connecting-ip", clientIp);
		const body = request.body ? await request.arrayBuffer() : null;
		return env.API.fetch(new Request(request, { body, headers }));
	},
};`;

await mkdir(runtime, { recursive: true });
await mkdir(resultsDirectory, { recursive: true });
await writeFile(workerLog, "");
if (path.relative(runtime, webDirectory) !== "web") {
	throw new Error("Test build output must stay inside the test directory");
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
		compatibility_date: compatibilityDate,
		compatibility_flags: compatibilityFlags,
		main: path.join(root, "apps/server/src/worker.ts"),
		name: "sapphire2-test",
	})
);

async function build(command: [string, ...string[]], cwd = root) {
	const child = spawn(command[0], command.slice(1), {
		cwd,
		env: {
			...process.env,
			VITE_PREVIEW_AUTO_LOGIN: "false",
			VITE_SERVER_URL: apiUrl,
			WRANGLER_SEND_METRICS: "false",
		},
		stdio: ["ignore", "pipe", "pipe"],
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
	cf: false,
	host: "127.0.0.1",
	https: true,
	log: new TestLog(),
	port: 18_787,
	workers: [
		{
			compatibilityDate,
			modules: true,
			name: "sapphire2-test-edge",
			script: edgeScript,
			serviceBindings: { API: apiWorkerName },
		},
		{
			bindings: {
				...readWorkerVars(),
				BETTER_AUTH_SECRET: "local-test-secret-with-at-least-32-characters",
				BETTER_AUTH_URL: apiUrl,
				CORS_ORIGIN: webUrl,
			},
			compatibilityDate,
			compatibilityFlags,
			d1Databases: ["DB"],
			modules: [
				{ path: path.join(workerDirectory, "worker.js"), type: "ESModule" },
			],
			name: apiWorkerName,
			outboundService: () =>
				new Response("Unexpected external request in test", { status: 502 }),
		},
	],
});
let web: Miniflare | undefined;

try {
	await applyMigrations(await api.getD1Database("DB", apiWorkerName));
	web = new Miniflare({
		assets: {
			assetConfig: { not_found_handling: "single-page-application" },
			directory: webDirectory,
			routerConfig: { has_user_worker: false },
		},
		cf: false,
		compatibilityDate,
		host: "127.0.0.1",
		https: true,
		log: new TestLog(),
		modules: true,
		name: "sapphire2-test-web",
		port: 13_001,
		script:
			"export default {fetch() {return new Response(null, {status: 404})}}",
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
