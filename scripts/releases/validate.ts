import {
	assertStringArg,
	getDiffNameStatus,
	isPendingMetadataPath,
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

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const mode = assertStringArg(args, "mode");
	const baseRef = assertStringArg(args, "base-ref");
	const headRef = assertStringArg(args, "head-ref");
	const headBranch = assertStringArg(args, "head-branch");
	const changedFiles = await getDiffNameStatus(baseRef, headRef);

	if (mode === "staging-pr") {
		const pendingFiles = changedFiles
			.filter(
				(entry) => entry.status !== "D" && isPendingMetadataPath(entry.path)
			)
			.map((entry) => entry.path);

		if (pendingFiles.length !== 1) {
			throw new Error(
				"`staging` PRs must include exactly one release metadata JSON under .release/pending/"
			);
		}

		const pendingFile = pendingFiles[0];
		if (!pendingFile) {
			throw new Error("Missing pending release metadata file");
		}

		await readReleaseMetadata(pendingFile);
		return;
	}

	if (mode !== "main-pr") {
		throw new Error(`Unsupported mode: ${mode}`);
	}

	if (headBranch !== "staging" && !headBranch.startsWith("hotfix/")) {
		throw new Error(
			"PRs into main must come from staging or hotfix/* branches"
		);
	}

	const requiredChangedFiles = [
		summaryPath,
		versionPath,
		latestReleaseNotesPath,
	];
	const diffPaths = new Set(changedFiles.map((entry) => entry.path));

	for (const filePath of requiredChangedFiles) {
		if (!diffPaths.has(filePath)) {
			throw new Error(
				`Expected ${filePath} to be updated in PRs targeting main. Run release:prepare-main-pr.`
			);
		}
	}

	const summary = await readJsonFile(summaryPath, releaseSummarySchema);
	const version = await readJsonFile(versionPath, versionFileSchema);
	const latestNotes = await readJsonFile(
		latestReleaseNotesPath,
		publicReleaseNotesSchema
	);

	if (summary.nextVersion !== version.version) {
		throw new Error(
			"Summary nextVersion and .release/version.json do not match"
		);
	}

	if (summary.nextVersion !== latestNotes.version) {
		throw new Error(
			"Summary nextVersion and latest release notes do not match"
		);
	}

	if (summary.entries.length === 0) {
		throw new Error("Release summary must include at least one entry");
	}

	if (
		headBranch.startsWith("hotfix/") &&
		summary.entries.some((entry) => entry.changes.type !== "fix")
	) {
		throw new Error("hotfix/* PRs may only contain fix releases");
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
