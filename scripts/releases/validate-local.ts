declare const Bun: typeof import("bun");

import {
	latestReleaseNotesPath,
	parseArgs,
	publicReleaseNotesSchema,
	readJsonFile,
	readReleaseMetadata,
	releaseSummarySchema,
	summaryPath,
	versionFileSchema,
	versionPath,
} from "./shared";

async function getChangedFiles(stagedOnly: boolean) {
	const args = stagedOnly
		? ["git", "diff", "--cached", "--name-only"]
		: ["git", "diff", "--name-only"];
	const proc = Bun.spawn(args, {
		stdout: "pipe",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();

	if (exitCode !== 0) {
		throw new Error(stderr.trim() || "Failed to inspect changed files");
	}

	return stdout
		.split("\n")
		.map((line) => line.trim().replaceAll("\\", "/"))
		.filter(Boolean);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const stagedOnly = args.staged === true;
	const changedFiles = await getChangedFiles(stagedOnly);

	const pendingFiles = changedFiles.filter(
		(filePath) =>
			filePath.startsWith(".release/pending/") && filePath.endsWith(".json")
	);

	for (const filePath of pendingFiles) {
		await readReleaseMetadata(filePath);
	}

	const shouldValidatePreparedRelease =
		changedFiles.includes(summaryPath) ||
		changedFiles.includes(versionPath) ||
		changedFiles.includes(latestReleaseNotesPath);

	if (!shouldValidatePreparedRelease) {
		return;
	}

	const summary = await readJsonFile(summaryPath, releaseSummarySchema);
	const version = await readJsonFile(versionPath, versionFileSchema);
	const latest = await readJsonFile(
		latestReleaseNotesPath,
		publicReleaseNotesSchema
	);

	if (summary.nextVersion !== version.version) {
		throw new Error(
			".release/version.json must match .release/summary/next-release.json"
		);
	}

	if (summary.nextVersion !== latest.version) {
		throw new Error(
			"apps/web/public/release-notes/latest.json must match the prepared release version"
		);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
