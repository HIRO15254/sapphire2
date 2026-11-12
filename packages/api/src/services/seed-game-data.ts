import type { Database } from "@sapphire2/db";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { eq, sql } from "drizzle-orm";
import type { BatchStatement } from "../lib/batch";
import { insertChunks } from "../lib/batch";
import { guardStatement, runGuardedBatch } from "../lib/write-guard";

type DbInstance = Database;

function builtinSeedId(
	userId: string,
	kind: "group" | "mix" | "variant",
	key: string
): string {
	return `${userId}:builtin-${kind}:${key}`;
}

export async function planDefaultGameData(
	db: DbInstance,
	userId: string
): Promise<BatchStatement[]> {
	const [existingGroup] = await db
		.select({ id: gameGroup.id })
		.from(gameGroup)
		.where(eq(gameGroup.userId, userId))
		.limit(1);
	if (existingGroup) {
		return [];
	}

	const [existingVariant] = await db
		.select({ id: gameVariant.id })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId))
		.limit(1);
	if (existingVariant) {
		return [];
	}

	const [existingMix] = await db
		.select({ id: gameMix.id })
		.from(gameMix)
		.where(eq(gameMix.userId, userId))
		.limit(1);
	if (existingMix) {
		return [];
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
				blind1Label: g.blind1Label,
				blind1Required: g.blind1Required,
				blind2Label: g.blind2Label,
				blind2Required: g.blind2Required,
				blind3Label: g.blind3Label,
				blind3Required: g.blind3Required,
				builtinKey: g.key,
				fixedAnteType: g.fixedAnteType,
				id: groupIdByKey.get(g.key) as string,
				label: g.label,
				updatedAt: now,
				userId,
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
					builtinKey: v.key,
					groupId,
					id: variantId,
					label: v.label,
					shortLabel: v.shortLabel,
					sortOrder: index,
					updatedAt: now,
					userId,
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
					builtinKey: m.key,
					id: mixId,
					label: m.label,
					updatedAt: now,
					userId,
				})
				.onConflictDoNothing()
		);
		const memberships = games.map((variantId, position) => ({
			mixId,
			position,
			userId,
			variantId,
		}));
		statements.push(
			...insertChunks(memberships, (chunk) =>
				db.insert(gameMixVariant).values(chunk).onConflictDoNothing()
			)
		);
	}

	statements.unshift(
		guardStatement(
			db,
			"game-seed-empty",
			sql`NOT EXISTS (SELECT 1 FROM ${gameGroup} WHERE ${gameGroup.userId} = ${userId} AND ${gameGroup.builtinKey} IS NULL)
				AND NOT EXISTS (SELECT 1 FROM ${gameVariant} WHERE ${gameVariant.userId} = ${userId} AND ${gameVariant.builtinKey} IS NULL)
				AND NOT EXISTS (SELECT 1 FROM ${gameMix} WHERE ${gameMix.userId} = ${userId} AND ${gameMix.builtinKey} IS NULL)`
		)
	);

	return statements;
}

export async function seedDefaultGameData(
	db: DbInstance,
	userId: string
): Promise<void> {
	const statements = await planDefaultGameData(db, userId);
	if (statements.length > 0) {
		await runGuardedBatch(db, statements);
	}
}
