declare const Bun: typeof import("bun");

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

export const pendingDirectory = ".release/pending";
export const summaryPath = ".release/summary/next-release.json";
export const versionPath = ".release/version.json";
export const latestReleaseNotesPath =
	"apps/web/public/release-notes/latest.json";
export const versionedReleaseNotesDirectory =
	"apps/web/public/release-notes/versions";
const whitespacePattern = /\s+/;
const releaseTitleHeadingPattern = /^# Release .*$/m;

const releaseChangeSchema = z.object({
	type: z.enum(["major", "minor", "fix"]),
	scope: z.enum(["user", "developer"]),
	additions: z.array(z.string().min(1)).optional(),
});

export const releaseMetadataSchema = z.object({
	title: z.string().min(1),
	summary: z.string().min(1),
	changes: releaseChangeSchema,
});

export const versionFileSchema = z.object({
	version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export const releaseNoteEntrySchema = z.object({
	title: z.string(),
	summary: z.string(),
	additions: z.array(z.string()).optional(),
});

export const publicReleaseNotesSchema = z.object({
	version: z.string().regex(/^\d+\.\d+\.\d+$/),
	releasedAt: z.string().datetime(),
	changes: z.object({
		user: z.array(releaseNoteEntrySchema),
		developer: z.array(releaseNoteEntrySchema),
	}),
});

export const releaseSummarySchema = z.object({
	baseVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
	nextVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
	generatedAt: z.string().datetime(),
	entries: z.array(releaseMetadataSchema),
	changes: publicReleaseNotesSchema.shape.changes,
});

export type ReleaseMetadata = z.infer<typeof releaseMetadataSchema>;
export type ReleaseSummary = z.infer<typeof releaseSummarySchema>;
export type PublicReleaseNotes = z.infer<typeof publicReleaseNotesSchema>;

type ParsedArgs = Record<string, string | boolean>;

export function parseArgs(argv: string[]): ParsedArgs {
	const args: ParsedArgs = {};

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token) {
			continue;
		}
		if (!token.startsWith("--")) {
			continue;
		}

		const [rawKey, inlineValue] = token.slice(2).split("=", 2);
		if (!rawKey) {
			continue;
		}
		if (inlineValue !== undefined) {
			args[rawKey] = inlineValue;
			continue;
		}

		const next = argv[index + 1];
		if (!next || next.startsWith("--")) {
			args[rawKey] = true;
			continue;
		}

		args[rawKey] = next;
		index += 1;
	}

	return args;
}

export function assertStringArg(
	args: ParsedArgs,
	name: string,
	errorMessage?: string
) {
	const value = args[name];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(errorMessage ?? `Missing --${name}`);
	}

	return value;
}

export async function readJsonFile<T>(
	filePath: string,
	schema: z.ZodType<T>
): Promise<T> {
	const raw = await readFile(resolve(filePath), "utf8");
	return schema.parse(JSON.parse(raw));
}

export async function writeJsonFile(filePath: string, data: unknown) {
	const target = resolve(filePath);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function removeFileIfExists(filePath: string) {
	if (!existsSync(resolve(filePath))) {
		return;
	}

	await rm(resolve(filePath), { force: true });
}

export async function getDiffNameStatus(baseRef: string, headRef: string) {
	const proc = Bun.spawn(
		["git", "diff", "--name-status", `${baseRef}...${headRef}`],
		{
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();

	if (exitCode !== 0) {
		throw new Error(stderr.trim() || "Failed to diff refs");
	}

	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [status, ...rest] = line.split(whitespacePattern);
			return {
				status,
				path: rest.join(" ").replaceAll("\\", "/"),
			};
		});
}

export async function getFileFromGitRef<T>(
	ref: string,
	filePath: string,
	schema: z.ZodType<T>
) {
	const proc = Bun.spawn(["git", "show", `${ref}:${filePath}`], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();

	if (exitCode !== 0) {
		throw new Error(stderr.trim() || `Failed to read ${filePath} from ${ref}`);
	}

	return schema.parse(JSON.parse(stdout));
}

export function isPendingMetadataPath(filePath: string) {
	return (
		filePath.startsWith(`${pendingDirectory}/`) && filePath.endsWith(".json")
	);
}

export function dedupeEntries(entries: ReleaseMetadata[]) {
	const seen = new Set<string>();
	return entries.filter((entry) => {
		const key = JSON.stringify(entry);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function groupEntries(entries: ReleaseMetadata[]) {
	return entries.reduce<PublicReleaseNotes["changes"]>(
		(acc, entry) => {
			acc[entry.changes.scope].push({
				title: entry.title,
				summary: entry.summary,
				additions: entry.changes.additions,
			});
			return acc;
		},
		{ user: [], developer: [] }
	);
}

export function getHighestReleaseType(entries: ReleaseMetadata[]) {
	if (entries.some((entry) => entry.changes.type === "major")) {
		return "major";
	}
	if (entries.some((entry) => entry.changes.type === "minor")) {
		return "minor";
	}
	return "fix";
}

export function bumpVersion(
	baseVersion: string,
	entries: ReleaseMetadata[]
): string {
	const [major = 0, minor = 0, patch = 0] = baseVersion.split(".").map(Number);
	const highestType = getHighestReleaseType(entries);

	if (highestType === "major") {
		return `${major + 1}.0.0`;
	}
	if (highestType === "minor") {
		return `${major}.${minor + 1}.0`;
	}
	return `${major}.${minor}.${patch + 1}`;
}

export function readReleaseMetadata(filePath: string) {
	return readJsonFile(filePath, releaseMetadataSchema);
}

export function readSummaryIfExists() {
	if (!existsSync(resolve(summaryPath))) {
		return null;
	}
	return readJsonFile(summaryPath, releaseSummarySchema);
}

export function readVersionIfExists() {
	if (!existsSync(resolve(versionPath))) {
		return null;
	}
	return readJsonFile(versionPath, versionFileSchema);
}

export function createSummary(
	baseVersion: string,
	entries: ReleaseMetadata[],
	generatedAt = new Date().toISOString()
): ReleaseSummary {
	const nextVersion = bumpVersion(baseVersion, entries);
	return {
		baseVersion,
		nextVersion,
		generatedAt,
		entries,
		changes: groupEntries(entries),
	};
}

export function createPublicReleaseNotes(
	summary: ReleaseSummary
): PublicReleaseNotes {
	return {
		version: summary.nextVersion,
		releasedAt: summary.generatedAt,
		changes: summary.changes,
	};
}

export function buildReleaseMarkdown(summary: ReleaseSummary) {
	const sections = [
		`# Release v${summary.nextVersion}`,
		"",
		`Base version: \`${summary.baseVersion}\``,
		`Generated at: ${summary.generatedAt}`,
		"",
	];

	for (const scope of ["user", "developer"] as const) {
		sections.push(
			`## ${scope === "user" ? "User impact" : "Developer impact"}`
		);
		sections.push("");

		const items = summary.changes[scope];
		if (items.length === 0) {
			sections.push("- None");
			sections.push("");
			continue;
		}

		for (const item of items) {
			sections.push(`- **${item.title}**: ${item.summary}`);
			for (const addition of item.additions ?? []) {
				sections.push(`  - ${addition}`);
			}
		}
		sections.push("");
	}

	return sections.join("\n").trimEnd();
}

export function buildPullRequestBody(summary: ReleaseSummary) {
	return [
		"## Release Summary",
		"",
		`This PR prepares release \`v${summary.nextVersion}\` from base \`${summary.baseVersion}\`.`,
		"",
		buildReleaseMarkdown(summary).replace(
			releaseTitleHeadingPattern,
			"### Notes"
		),
	].join("\n");
}
