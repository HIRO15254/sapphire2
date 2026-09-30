import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { appRouter } from "../packages/api/src/routers";

const MEDIA_TYPES: Record<string, string> = {
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
};

const MODES = ["tournament", "seats"] as const;
type Mode = (typeof MODES)[number];

function usage(): never {
	process.stderr.write(
		`usage: bun run try:ai-extract <${MODES.join("|")}> <image> [image...]\n\nReads OPENAI_API_KEY from the environment, falling back to apps/server/.dev.vars.\n`
	);
	process.exit(2);
}

async function readApiKey(): Promise<string> {
	const fromEnv = process.env.OPENAI_API_KEY?.trim();
	if (fromEnv) {
		return fromEnv;
	}
	let devVars = "";
	try {
		devVars = await readFile("apps/server/.dev.vars", "utf8");
	} catch {
		throw new Error(
			"OPENAI_API_KEY is not set and apps/server/.dev.vars was not found"
		);
	}
	const line = devVars
		.split("\n")
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith("OPENAI_API_KEY="));
	const value = line
		?.slice("OPENAI_API_KEY=".length)
		.replace(/^["']|["']$/g, "");
	if (!value) {
		throw new Error("apps/server/.dev.vars does not define OPENAI_API_KEY");
	}
	return value;
}

async function readSource(path: string) {
	const mediaType = MEDIA_TYPES[extname(path).toLowerCase()];
	if (!mediaType) {
		throw new Error(
			`unsupported image type for ${path} (allowed: ${Object.keys(MEDIA_TYPES).join(", ")})`
		);
	}
	const data = await readFile(path);
	return {
		kind: "image" as const,
		data: data.toString("base64"),
		mediaType: mediaType as
			| "image/gif"
			| "image/jpeg"
			| "image/png"
			| "image/webp",
	};
}

async function main(): Promise<void> {
	const [mode, ...paths] = process.argv.slice(2);
	if (!(mode && MODES.includes(mode as Mode)) || paths.length === 0) {
		usage();
	}

	const openaiApiKey = await readApiKey();
	const sources = await Promise.all(paths.map(readSource));
	const caller = appRouter.createCaller({
		session: { user: { id: "try-ai-extract" } },
		openaiApiKey,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).aiExtract;

	process.stderr.write(
		`${mode}: ${paths.map((path) => basename(path)).join(", ")}\n`
	);
	const startedAt = Date.now();
	const result =
		mode === "tournament"
			? await caller.extractTournamentData({ sources })
			: await caller.extractTablePlayers({
					sourceApp: "dmm_waitinglist",
					sources,
				});
	process.stderr.write(`took ${Date.now() - startedAt}ms\n`);
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`
	);
	process.exit(1);
});
