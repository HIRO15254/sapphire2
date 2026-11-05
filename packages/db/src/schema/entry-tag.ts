import { relations } from "drizzle-orm";
import { user } from "./auth";
import { entry } from "./entry";
import { defineTagTables } from "./tag-tables";

export const { tag: entryTag, link: entryTagLink } = defineTagTables(
	"entry",
	() => entry
);

export const entryTagRelations = relations(entryTag, ({ one, many }) => ({
	user: one(user, {
		fields: [entryTag.userId],
		references: [user.id],
	}),
	links: many(entryTagLink),
}));

export const entryTagLinkRelations = relations(entryTagLink, ({ one }) => ({
	entry: one(entry, {
		fields: [entryTagLink.entryId, entryTagLink.userId],
		references: [entry.id, entry.userId],
	}),
	tag: one(entryTag, {
		fields: [entryTagLink.tagId, entryTagLink.userId],
		references: [entryTag.id, entryTag.userId],
	}),
}));
