import { readdir, readFile } from "node:fs/promises";
import type { Miniflare } from "miniflare";

const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const migrationsDirectory = new URL(
	"../../../db/src/migrations/",
	import.meta.url
);

export type TestD1Database = Awaited<ReturnType<Miniflare["getD1Database"]>>;

/** Apply production SQL, including manually maintained triggers, to an empty D1. */
export async function applyMigrations(d1: TestD1Database): Promise<void> {
	const names = (await readdir(migrationsDirectory))
		.filter((name) => MIGRATION_FILE_PATTERN.test(name))
		.sort();
	for (const name of names) {
		const sql = await readFile(new URL(name, migrationsDirectory), "utf8");
		try {
			// exec() splits on newlines, breaking multiline DDL and trigger bodies.
			await d1.prepare(sql).run();
		} catch (error) {
			throw new Error(`Test database migration failed: ${name}`, {
				cause: error,
			});
		}
	}
}
