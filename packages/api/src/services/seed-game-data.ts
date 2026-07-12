import type { Database } from "@sapphire2/db";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_VARIANTS,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { eq } from "drizzle-orm";

type DbInstance = Database;

/**
 * A single statement accepted by D1's `db.batch([...])` (a drizzle query
 * builder passed UN-awaited). Mirrors the `BatchStatement` helper type in
 * `packages/api/src/routers/session.ts`.
 */
type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

async function runBatch(
	db: DbInstance,
	statements: BatchStatement[]
): Promise<void> {
	if (statements.length === 0) {
		return;
	}
	await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

/**
 * Seed the built-in game groups + game variants for a user. Both masters are
 * per-user DB rows (mix-game rework): code constants (`DEFAULT_GAME_GROUPS`,
 * `DEFAULT_GAME_VARIANTS`) are seed data only, never a runtime fallback, so
 * every user needs their own copy of these rows to pick from.
 *
 * Idempotent guard: if the user already has ANY gameGroup row OR ANY
 * gameVariant row, this is a no-op. That respects an intentional deletion —
 * a user who cleared out their variant list should stay empty rather than
 * being re-seeded on the next read — so only a fully-empty account (neither
 * table has a row) gets seeded.
 *
 * Called once from the `better-auth` `user.create` hook (packages/auth) so
 * every new account starts with the full builtin list, and defensively from
 * `gameVariant.list` / `gameGroup.list` in case a legacy account predates the
 * hook.
 */
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

	const now = new Date();
	const groupIdByKey = new Map(
		DEFAULT_GAME_GROUPS.map((g) => [g.key, crypto.randomUUID()])
	);

	const statements: BatchStatement[] = DEFAULT_GAME_GROUPS.map((g) =>
		db.insert(gameGroup).values({
			id: groupIdByKey.get(g.key) as string,
			userId,
			builtinKey: g.key,
			label: g.label,
			blind1Label: g.blind1Label,
			blind2Label: g.blind2Label,
			blind3Label: g.blind3Label,
			updatedAt: now,
		})
	);

	for (const [index, v] of DEFAULT_GAME_VARIANTS.entries()) {
		const groupId = groupIdByKey.get(v.groupKey);
		if (!groupId) {
			// Unreachable given DEFAULT_GAME_VARIANTS/DEFAULT_GAME_GROUPS are kept
			// in sync (every groupKey has a matching seeded group) — guarded so a
			// future data-entry mistake fails closed instead of inserting a
			// dangling groupId.
			continue;
		}
		statements.push(
			db.insert(gameVariant).values({
				id: crypto.randomUUID(),
				userId,
				builtinKey: v.key,
				label: v.label,
				shortLabel: v.shortLabel,
				groupId,
				sortOrder: index,
				updatedAt: now,
			})
		);
	}

	// All 24 inserts commit as one atomic batch (SA2-116) — a mid-sequence
	// failure can no longer leave a user with some builtin groups/variants but
	// not others.
	await runBatch(db, statements);
}
