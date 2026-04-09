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
	const markdown =
		target === "pr"
			? buildPullRequestBody(summary)
			: target === "release"
				? buildReleaseMarkdown(summary)
				: null;

	if (!markdown) {
		throw new Error(`Unsupported render target: ${target}`);
	}

	await writeFile(output, `${markdown}\n`, "utf8");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
