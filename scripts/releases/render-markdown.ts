import { writeFile } from "node:fs/promises";
import {
	assertStringArg,
	buildPullRequestBody,
	buildReleaseMarkdown,
	parseArgs,
	readJsonFile,
	releaseSummarySchema,
	summaryPath,
} from "./shared";

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const output = assertStringArg(args, "output");
	const target = assertStringArg(args, "target");
	const summary = await readJsonFile(summaryPath, releaseSummarySchema);
	let markdown: string;
	if (target === "pr") {
		markdown = buildPullRequestBody(summary);
	} else if (target === "release") {
		markdown = buildReleaseMarkdown(summary);
	} else {
		throw new Error(`Unsupported render target: ${target}`);
	}

	await writeFile(output, `${markdown}\n`, "utf8");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
