import type { Database } from "@sapphire2/db";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { eq } from "drizzle-orm";

export type GameMixWithGames = typeof gameMix.$inferSelect & {
	games: string[];
};

/**
 * Reconstructs the public `games: string[]` contract from normalized rows.
 * Memberships are owner-scoped and fetched once for the whole input collection
 * rather than once per mix.
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
	const memberships = (
		await db
			.select({
				mixId: gameMixVariant.mixId,
				position: gameMixVariant.position,
				userId: gameMixVariant.userId,
				variantId: gameMixVariant.variantId,
			})
			.from(gameMixVariant)
			.where(eq(gameMixVariant.userId, userId))
	).filter((row) => row.userId === userId && mixIds.has(row.mixId));

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
