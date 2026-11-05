import { relations } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { hand } from "./hand";
import { defineTagTables } from "./tag-tables";

export const { tag: handTag, link: handTagLink } = defineTagTables(
	"hand",
	() => hand,
	{ linkColumns: { reviewedAt: integer("reviewed_at", { mode: "timestamp" }) } }
);

export const handTagRelations = relations(handTag, ({ one, many }) => ({
	user: one(user, {
		fields: [handTag.userId],
		references: [user.id],
	}),
	links: many(handTagLink),
}));

export const handTagLinkRelations = relations(handTagLink, ({ one }) => ({
	hand: one(hand, {
		fields: [handTagLink.handId, handTagLink.userId],
		references: [hand.id, hand.userId],
	}),
	tag: one(handTag, {
		fields: [handTagLink.tagId, handTagLink.userId],
		references: [handTag.id, handTag.userId],
	}),
}));
