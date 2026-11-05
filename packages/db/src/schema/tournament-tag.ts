import { relations } from "drizzle-orm";
import { user } from "./auth";
import { defineTagTables } from "./tag-tables";
import { tournament } from "./tournament";

export const { tag: tournamentTag, link: tournamentTagLink } = defineTagTables(
	"tournament",
	() => tournament,
	{ tagTable: "tournament_tag_def" }
);

export const tournamentTagRelations = relations(
	tournamentTag,
	({ one, many }) => ({
		user: one(user, {
			fields: [tournamentTag.userId],
			references: [user.id],
		}),
		links: many(tournamentTagLink),
	})
);

export const tournamentTagLinkRelations = relations(
	tournamentTagLink,
	({ one }) => ({
		tournament: one(tournament, {
			fields: [tournamentTagLink.tournamentId, tournamentTagLink.userId],
			references: [tournament.id, tournament.userId],
		}),
		tag: one(tournamentTag, {
			fields: [tournamentTagLink.tagId, tournamentTagLink.userId],
			references: [tournamentTag.id, tournamentTag.userId],
		}),
	})
);
