import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { limitFormat } from "./limit-format";
import { ringGame } from "./ring-game";

export const ringGameBlindSet = sqliteTable(
	"ring_game_blind_set",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ringGameId: text("ring_game_id")
			.notNull()
			.references(() => ringGame.id, { onDelete: "cascade" }),
		limitFormatId: integer("limit_format_id")
			.notNull()
			.references(() => limitFormat.id, { onDelete: "restrict" }),
		blind1: integer("blind1").notNull(),
		blind2: integer("blind2").notNull(),
		blind3: integer("blind3"),
		blind4: integer("blind4"),
		ante: integer("ante"),
		anteType: text("ante_type"),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		index("ringGameBlindSet_ringGameId_idx").on(table.ringGameId),
		unique("ringGameBlindSet_ringGameId_sortOrder_uniq").on(
			table.ringGameId,
			table.sortOrder
		),
	]
);

export const ringGameBlindSetRelations = relations(
	ringGameBlindSet,
	({ one }) => ({
		ringGame: one(ringGame, {
			fields: [ringGameBlindSet.ringGameId],
			references: [ringGame.id],
		}),
		limitFormat: one(limitFormat, {
			fields: [ringGameBlindSet.limitFormatId],
			references: [limitFormat.id],
		}),
	})
);
