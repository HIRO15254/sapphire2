import { writeFile } from "node:fs/promises";
import {
	assertStringArg,
	buildReleaseMarkdown,
	parseArgs,
	publicReleaseNotesSchema,
	readJsonFile,
	releaseSummarySchema,
	summaryPath,
} from "./shared";

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const notesOutput = assertStringArg(args, "notes-output");
	const envOutput = assertStringArg(args, "env-output");
	const summary = await readJsonFile(summaryPath, releaseSummarySchema);
	await readJsonFile(
		"apps/web/public/release-notes/latest.json",
		publicReleaseNotesSchema
	);

	const markdown = buildReleaseMarkdown(summary);

	await writeFile(notesOutput, `${markdown}\n`, "utf8");
	await writeFile(
		envOutput,
		`RELEASE_VERSION=${summary.nextVersion}\nRELEASE_TAG=v${summary.nextVersion}\n`,
		"utf8"
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
