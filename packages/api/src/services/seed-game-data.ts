import type { Database } from "@sapphire2/db";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { and, eq } from "drizzle-orm";
import type { BatchStatement } from "../lib/batch";
import { runBatch } from "../lib/batch";
import { isLabelConflictError } from "../lib/db-errors";
import { chunkMembershipRows } from "./game-mix";

type DbInstance = Database;

function builtinSeedId(
	userId: string,
	kind: "group" | "mix" | "variant",
	key: string
): string {
	return `${userId}:builtin-${kind}:${key}`;
}

export async function seedDefaultGameData(
	db: DbInstance,
	userId: string
): Promise<void> {
	const [existingGroup] = await db
		.select({ id: gameGroup.id })
		.from(gameGroup)
		.where(eq(gameGroup.userId, userId))
		.limit(1);
	if (existingGroup) {
		return;
	}

	const [existingVariant] = await db
		.select({ id: gameVariant.id })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId))
		.limit(1);
	if (existingVariant) {
		return;
	}

	const [existingMix] = await db
		.select({ id: gameMix.id })
		.from(gameMix)
		.where(eq(gameMix.userId, userId))
		.limit(1);
	if (existingMix) {
		return;
	}

	const now = new Date();
	const groupIdByKey = new Map(
		DEFAULT_GAME_GROUPS.map((g) => [
			g.key,
			builtinSeedId(userId, "group", g.key),
		])
	);

	const statements: BatchStatement[] = DEFAULT_GAME_GROUPS.map((g) =>
		db
			.insert(gameGroup)
			.values({
				id: groupIdByKey.get(g.key) as string,
				userId,
				builtinKey: g.key,
				label: g.label,
				blind1Label: g.blind1Label,
				blind2Label: g.blind2Label,
				blind3Label: g.blind3Label,
				updatedAt: now,
			})
			.onConflictDoNothing()
	);

	const variantIdByKey = new Map<string, string>();

	for (const [index, v] of DEFAULT_GAME_VARIANTS.entries()) {
		const groupId = groupIdByKey.get(v.groupKey);
		if (!groupId) {
			continue;
		}
		const variantId = builtinSeedId(userId, "variant", v.key);
		variantIdByKey.set(v.key, variantId);
		statements.push(
			db
				.insert(gameVariant)
				.values({
					id: variantId,
					userId,
					builtinKey: v.key,
					label: v.label,
					shortLabel: v.shortLabel,
					groupId,
					sortOrder: index,
					updatedAt: now,
				})
				.onConflictDoNothing()
		);
	}

	for (const m of DEFAULT_GAME_MIXES) {
		const mixId = builtinSeedId(userId, "mix", m.key);
		const games = m.variantKeys
			.map((key) => variantIdByKey.get(key))
			.filter((id): id is string => id !== undefined);
		statements.push(
			db
				.insert(gameMix)
				.values({
					id: mixId,
					userId,
					builtinKey: m.key,
					label: m.label,
					games: [],
					updatedAt: now,
				})
				.onConflictDoNothing()
		);
		const memberships = games.map((variantId, position) => ({
			mixId,
			position,
			userId,
			variantId,
		}));
		for (const chunk of chunkMembershipRows(memberships)) {
			statements.push(
				db.insert(gameMixVariant).values(chunk).onConflictDoNothing()
			);
		}
		statements.push(
			db
				.update(gameMix)
				.set({ games, updatedAt: now })
				.where(and(eq(gameMix.id, mixId), eq(gameMix.userId, userId)))
		);
	}

	try {
		await runBatch(db, statements);
	} catch (error) {
		if (isLabelConflictError(error)) {
			return;
		}
		throw error;
	}
}
