import { existsSync } from "node:fs";
import {
	assertStringArg,
	createPublicReleaseNotes,
	createSummary,
	dedupeEntries,
	getDiffNameStatus,
	getFileFromGitRef,
	isPendingMetadataPath,
	latestReleaseNotesPath,
	parseArgs,
	readJsonFile,
	readReleaseMetadata,
	releaseSummarySchema,
	removeFileIfExists,
	summaryPath,
	versionedReleaseNotesDirectory,
	versionFileSchema,
	versionPath,
	writeJsonFile,
} from "./shared";

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const baseRef = assertStringArg(args, "base-ref");
	const headRef = assertStringArg(args, "head-ref");
	const changedFiles = await getDiffNameStatus(baseRef, headRef);
	const diffPaths = new Set(changedFiles.map((entry) => entry.path));

	const existingSummary =
		diffPaths.has(summaryPath) && existsSync(summaryPath)
			? await readJsonFile(summaryPath, releaseSummarySchema)
			: null;

	const pendingFiles = changedFiles
		.filter((entry) => entry.status !== "D" && isPendingMetadataPath(entry.path))
		.map((entry) => entry.path);

	const pendingEntries = await Promise.all(
		pendingFiles.map((filePath) => readReleaseMetadata(filePath))
	);

	const entries = dedupeEntries([
		...(existingSummary?.entries ?? []),
		...pendingEntries,
	]);

	if (entries.length === 0) {
		throw new Error("No release metadata found to prepare a main PR");
	}

	const baseVersion = await getFileFromGitRef(baseRef, versionPath, versionFileSchema);
	const summary = createSummary(baseVersion.version, entries);
	const latestNotes = createPublicReleaseNotes(summary);

	await writeJsonFile(summaryPath, summary);
	await writeJsonFile(versionPath, { version: summary.nextVersion });
	await writeJsonFile(latestReleaseNotesPath, latestNotes);
	await writeJsonFile(
		`${versionedReleaseNotesDirectory}/${summary.nextVersion}.json`,
		latestNotes
	);

	for (const filePath of pendingFiles) {
		await removeFileIfExists(filePath);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
