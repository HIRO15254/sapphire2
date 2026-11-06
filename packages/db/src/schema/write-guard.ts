import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const writeGuard = sqliteTable(
	"write_guard",
	{
		name: text("name").notNull(),
	},
	() => [check("write_guard_failed", sql`0`)]
);
