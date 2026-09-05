import type { Database } from "@sapphire2/db";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { and, eq, inArray } from "drizzle-orm";
import { chunkForInsert, D1_MAX_BOUND_PARAMS } from "../lib/batch";

export type GameMixWithGames = typeof gameMix.$inferSelect & {
	games: string[];
};

const MAX_MIX_IDS_PER_LOOKUP = D1_MAX_BOUND_PARAMS - 1;

export function chunkMembershipRows(
	rows: (typeof gameMixVariant.$inferInsert)[]
): (typeof gameMixVariant.$inferInsert)[][] {
	return chunkForInsert(rows, Object.keys(rows[0] ?? {}).length || 1);
}

export async function hydrateOwnedGameMixes(
	db: Database,
	userId: string,
	mixes: (typeof gameMix.$inferSelect)[]
): Promise<GameMixWithGames[]> {
	const ownedMixes = mixes.filter((mix) => mix.userId === userId);
	if (ownedMixes.length === 0) {
		return [];
	}

	const mixIds = new Set(ownedMixes.map((mix) => mix.id));
	const ownerScope = eq(gameMixVariant.userId, userId);
	const memberships = (
		await db
			.select({
				mixId: gameMixVariant.mixId,
				position: gameMixVariant.position,
				variantId: gameMixVariant.variantId,
			})
			.from(gameMixVariant)
			.where(
				mixIds.size <= MAX_MIX_IDS_PER_LOOKUP
					? and(ownerScope, inArray(gameMixVariant.mixId, [...mixIds]))
					: ownerScope
			)
	).filter((row) => mixIds.has(row.mixId));

	const gamesByMixId = new Map<string, typeof memberships>();
	for (const membership of memberships) {
		const bucket = gamesByMixId.get(membership.mixId);
		if (bucket) {
			bucket.push(membership);
		} else {
			gamesByMixId.set(membership.mixId, [membership]);
		}
	}

	return ownedMixes.map((mix) => ({
		...mix,
		games: (gamesByMixId.get(mix.id) ?? [])
			.toSorted((left, right) => left.position - right.position)
			.map((membership) => membership.variantId),
	}));
}

export async function listOwnedGameMixes(
	db: Database,
	userId: string
): Promise<GameMixWithGames[]> {
	const mixes = await db
		.select()
		.from(gameMix)
		.where(eq(gameMix.userId, userId));
	return await hydrateOwnedGameMixes(db, userId, mixes);
}
