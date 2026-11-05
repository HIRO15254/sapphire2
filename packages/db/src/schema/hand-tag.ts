import { integer } from "drizzle-orm/sqlite-core";
import { hand } from "./hand";
import { defineTagTables } from "./tag-tables";

export const { tag: handTag, link: handTagLink } = defineTagTables(
	"hand",
	() => hand,
	{ linkColumns: { reviewedAt: integer("reviewed_at", { mode: "timestamp" }) } }
);
