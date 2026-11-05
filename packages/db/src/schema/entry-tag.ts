import { relations, sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { entry } from "./entry";

export const entryTag = sqliteTable(
	"entry_tag",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("entry_tag_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("entry_tag_name_uq").on(t.userId, sql`lower(trim(${t.name}))`),
	]
);

export const entryTagLink = sqliteTable(
	"entry_tag_link",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		entryId: text("entry_id").notNull(),
		tagId: text("tag_id").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.entryId, t.tagId] }),
		index("entry_tag_link_tag_idx").on(t.tagId),
		foreignKey({
			columns: [t.entryId, t.userId],
			foreignColumns: [entry.id, entry.userId],
			name: "entry_tag_link_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.tagId, t.userId],
			foreignColumns: [entryTag.id, entryTag.userId],
			name: "entry_tag_link_tag_owner_fk",
		}).onDelete("cascade"),
	]
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
