import type { Database } from "@sapphire2/db";
import { gameLineup } from "@sapphire2/db/schema/game-lineup";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { and, eq, exists, inArray, sql } from "drizzle-orm";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";

export const gameMixColumns = {
	archivedAt: gameMix.archivedAt,
	builtinKey: gameMix.builtinKey,
	createdAt: gameMix.createdAt,
	id: gameMix.id,
	label: gameMix.label,
	updatedAt: gameMix.updatedAt,
	userId: gameMix.userId,
};

export type GameMixRow = typeof gameMix.$inferSelect;

export type GameMixWithGames = GameMixRow & {
	games: string[];
};

export type ListedGameMix = GameMixWithGames & { isReferenced: boolean };

export function mixLineupReference(db: Database) {
	return db
		.select({ id: gameLineup.id })
		.from(gameLineup)
		.where(
			and(
				eq(gameLineup.gameMixId, gameMix.id),
				eq(gameLineup.userId, gameMix.userId)
			)
		);
}

const MAX_MIX_IDS_PER_LOOKUP = D1_MAX_BOUND_PARAMS - 1;

export async function hydrateOwnedGameMixes<T extends GameMixRow>(
	db: Database,
	userId: string,
	mixes: T[]
): Promise<(T & { games: string[] })[]> {
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
): Promise<ListedGameMix[]> {
	const mixes = await db
		.select({
			...gameMixColumns,
			isReferenced: sql<boolean>`${exists(mixLineupReference(db))}`.mapWith(
				Boolean
			),
		})
		.from(gameMix)
		.where(eq(gameMix.userId, userId));
	return await hydrateOwnedGameMixes(db, userId, mixes);
}
