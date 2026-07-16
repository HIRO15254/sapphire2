import type { Database } from "@sapphire2/db";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { eq } from "drizzle-orm";
import type { BatchStatement } from "../lib/batch";
import { runBatch } from "../lib/batch";
import { isLabelConflictError } from "../lib/db-errors";

type DbInstance = Database;

function builtinSeedId(
	userId: string,
	kind: "group" | "mix" | "variant",
	key: string
): string {
	return `${userId}:builtin-${kind}:${key}`;
}

/**
 * Seed the built-in game groups + game variants + named mixes for a user. All
 * three masters are per-user DB rows (mix-game rework): code constants
 * (`DEFAULT_GAME_GROUPS`, `DEFAULT_GAME_VARIANTS`, `DEFAULT_GAME_MIXES`) are
 * seed data only, never a runtime fallback, so every user needs their own
 * copy of these rows to pick from. Each seeded mix's `games` column is
 * resolved to THIS user's freshly seeded variant row ids (not the variant
 * keys) so it references game_variant by id like any other mix (see
 * `packages/db/src/schema/game-mix.ts`).
 *
 * Idempotent guard: if the user already has ANY gameGroup row OR ANY
 * gameVariant row OR ANY gameMix row, this is a no-op (c09). That respects an
 * intentional deletion — a user who cleared out their variant list (or just
 * their mixes) should stay empty rather than being re-seeded on the next read
 * — so only a fully-empty account (none of the three tables has a row) gets
 * seeded. Checking all three (not just group/variant) closes a gap where a
 * user who deleted every group/variant but kept a custom mix would have had
 * the builtins re-inserted underneath their remaining mix.
 *
 * Called once from the `better-auth` `user.create` hook (packages/auth) so
 * every new account starts with the full builtin list, and defensively from
 * `gameVariant.list` / `gameGroup.list` / `gameMix.list` in case a legacy
 * account predates the hook.
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

	// Stable per-user ids keep both racing batches pointing at the same
	// group/variant ids, so a losing group insert cannot leave its variant
	// statements referencing group ids that never committed. `.onConflictDoNothing()`
	// alone is NOT enough under the migration-0041 label triggers, though: a
	// BEFORE trigger's RAISE(ABORT) fires before ON CONFLICT resolution and
	// rejects the whole losing batch — so the race is caught below, not here.
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
			// Unreachable given DEFAULT_GAME_VARIANTS/DEFAULT_GAME_GROUPS are kept
			// in sync (every groupKey has a matching seeded group) — guarded so a
			// future data-entry mistake fails closed instead of inserting a
			// dangling groupId.
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
		const games = m.variantKeys
			.map((key) => variantIdByKey.get(key))
			.filter((id): id is string => id !== undefined);
		statements.push(
			db
				.insert(gameMix)
				.values({
					id: builtinSeedId(userId, "mix", m.key),
					userId,
					builtinKey: m.key,
					label: m.label,
					games,
					updatedAt: now,
				})
				.onConflictDoNothing()
		);
	}

	// All 27 inserts (3 groups + 21 variants + 3 mixes) commit as one atomic
	// batch (SA2-116) — a mid-sequence failure can no longer leave a user with
	// some builtin groups/variants/mixes but not others.
	try {
		await runBatch(db, statements);
	} catch (error) {
		// A concurrent seed (another `list` self-seed, or the auth-hook seed)
		// committed the same builtin rows first; the migration-0041 label
		// triggers then RAISE(ABORT) on this losing batch. That is a benign
		// "someone else already seeded" outcome, not a failure — the three
		// `list` procedures call this WITHOUT a try/catch, so surfacing it would
		// turn a routine first-load race into a 500 (c09). Any OTHER error is a
		// real failure and must propagate.
		//
		// This swallow is only sound while the builtin labels are mutually
		// unique under those triggers (two builtins sharing a normalized label
		// would abort every seed and be silently hidden here) — that invariant
		// is pinned by seed-game-data.test.ts.
		if (isLabelConflictError(error)) {
			return;
		}
		throw error;
	}
}
