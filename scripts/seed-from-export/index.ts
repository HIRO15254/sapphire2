#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformAll } from "./transform";

const exportPath = process.argv[2];
if (!exportPath) {
	console.error(
		"Usage: bun run scripts/seed-from-export <path/to/prod-export.sql>"
	);
	console.error(
		"  Generate the input with: wrangler d1 export sapphire2-db --remote --output prod-export.sql"
	);
	process.exit(1);
}

const sql = readFileSync(exportPath, "utf8");

const tmpDb = new Database(":memory:");
tmpDb.exec("PRAGMA foreign_keys = OFF;");
tmpDb.exec(sql);

const newSql = transformAll(tmpDb);

const outPath = resolve(exportPath, "..", "seed-local.sql");
writeFileSync(outPath, newSql, "utf8");

console.log(`Wrote: ${outPath}`);
console.log("");
console.log("Apply to local D1 with:");
console.log(
	`  bun x wrangler d1 execute sapphire2-db --local -c apps/server/wrangler.toml --file=${outPath}`
);
