import type { Database } from "@sapphire2/db";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { and, eq, inArray } from "drizzle-orm";
import { chunkForInsert, D1_MAX_BOUND_PARAMS } from "../lib/batch";

export type GameMixWithGames = typeof gameMix.$inferSelect & {
	games: string[];
};

/**
 * How many mix ids may join the owner predicate in one `IN (…)`. The userId
 * comparison binds the remaining parameter of D1's per-statement cap.
 */
const MAX_MIX_IDS_PER_LOOKUP = D1_MAX_BOUND_PARAMS - 1;

/**
 * Split membership rows across INSERTs that stay under D1's bind-param cap.
 * The width comes from the row shape rather than a literal, so adding a column
 * to gameMixVariant cannot silently overflow the cap. Shared by the mix router
 * and the default-data seed so both size their INSERTs the same way (a builtin
 * mix wide enough to overflow is otherwise a silent runtime failure).
 */
export function chunkMembershipRows(
	rows: (typeof gameMixVariant.$inferInsert)[]
): (typeof gameMixVariant.$inferInsert)[][] {
	return chunkForInsert(rows, Object.keys(rows[0] ?? {}).length || 1);
}

/**
 * Reconstructs the public `games: string[]` contract from normalized rows.
 * Memberships are owner-scoped and fetched once for the whole input collection
 * rather than once per mix. The id list is bound too whenever it fits under
 * D1's bind-param cap, so hydrating a single mix (gameMix.update's label-only
 * path) does not read every membership row the caller owns; beyond that the
 * query stays owner-scoped and the extra rows are bucketed away below.
 */
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

/**
 * Loads every caller-owned mix and hydrates all compositions in at most two
 * queries (one master read plus one owner-scoped membership read).
 */
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
