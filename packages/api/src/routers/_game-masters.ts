import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import z from "zod";
import type { protectedProcedure } from "../index";
import { isGameMasterLabelConflictError } from "../lib/db-errors";

export type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

export function gameMasterListInputSchema() {
	return z.object({ includeArchived: z.boolean().optional() }).optional();
}

export function compareBuiltinFirst(
	builtinOrder: Map<string, number>
): (
	a: { builtinKey: string | null; label: string },
	b: { builtinKey: string | null; label: string }
) => number {
	return (a, b) => {
		const aOrder = a.builtinKey ? builtinOrder.get(a.builtinKey) : undefined;
		const bOrder = b.builtinKey ? builtinOrder.get(b.builtinKey) : undefined;
		if (aOrder !== undefined && bOrder !== undefined) {
			return aOrder - bOrder;
		}
		if (aOrder !== undefined) {
			return -1;
		}
		if (bOrder !== undefined) {
			return 1;
		}
		return a.label.localeCompare(b.label);
	};
}

const LABELLED_MASTERS = {
	"game group": { index: "game_group_label_uq", table: gameGroup },
	"game mix": { index: "game_mix_label_uq", table: gameMix },
	"game variant": { index: "game_variant_label_uq", table: gameVariant },
} as const;

export async function runLabelWrite<T>(
	db: Db,
	master: keyof typeof LABELLED_MASTERS,
	userId: string,
	label: string | undefined,
	write: () => Promise<T>
): Promise<T> {
	try {
		return await write();
	} catch (error) {
		const { table, index } = LABELLED_MASTERS[master];
		if (label === undefined || !isGameMasterLabelConflictError(error, index)) {
			throw error;
		}
		const [holder] = await db
			.select({ archivedAt: table.archivedAt })
			.from(table)
			.where(
				and(
					eq(table.userId, userId),
					sql`lower(trim(${table.label})) = lower(trim(${label}))`
				)
			)
			.limit(1);
		throw new TRPCError({
			code: "CONFLICT",
			message: holder?.archivedAt
				? `An archived ${master} already has this label; restore it instead`
				: `You already have a ${master} with this label`,
		});
	}
}
