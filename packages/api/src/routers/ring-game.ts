import type { Database } from "@sapphire2/db";
import { asset } from "@sapphire2/db/schema/asset";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room as roomTable } from "@sapphire2/db/schema/room";
import { cashRule } from "@sapphire2/db/schema/rule";
import { idSchema as id } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { activeReferenceGuard } from "../lib/active-reference-guard";
import type { BatchStatement } from "../lib/batch";
import { isForeignKeyConstraintError } from "../lib/db-errors";
import { memoSchema } from "../lib/master-input-schemas";
import { validateEntityOwnership, validateOwnedIds } from "../lib/ownership";
import { changedRowsGuardStatement, runGuardedBatch } from "../lib/write-guard";
import {
	cashRuleInputSchema,
	hydrateCashRules,
	prepareCashRule,
} from "../services/cash-rules";

const name = z.string().trim().min(1).max(100);
export const ringGameListByRoomInputSchema = z.object({
	includeArchived: z.boolean().optional(),
	roomId: id,
});
export const ringGameIdInputSchema = z.object({ id });
export const ringGameCreateInputSchema = z.object({
	defaultAssetId: id.nullable().optional(),
	memo: memoSchema.nullable().optional(),
	name,
	roomId: id,
	rule: cashRuleInputSchema,
});
export const ringGameUpdateInputSchema = z.object({
	defaultAssetId: id.nullable().optional(),
	id,
	memo: memoSchema.nullable().optional(),
	name: name.optional(),
	rule: cashRuleInputSchema.optional(),
});
export const ringGameRestoreRuleInputSchema = z.object({
	id,
	ruleVersionId: id,
});

async function validateAsset(
	db: Database,
	userId: string,
	assetId: string | null | undefined,
	current?: string | null
) {
	if (!assetId) {
		return;
	}
	const ownedAsset = await validateEntityOwnership(
		db,
		"asset",
		assetId,
		userId
	);
	if (ownedAsset.archivedAt && assetId !== current) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An archived asset cannot be newly selected",
		});
	}
}

export async function planRingGameCreate(
	db: Database,
	params: {
		id: string;
		input: z.infer<typeof ringGameCreateInputSchema>;
		userId: string;
		now: Date;
	}
): Promise<{ ruleId: string; statements: BatchStatement[] }> {
	const room = await validateEntityOwnership(
		db,
		"room",
		params.input.roomId,
		params.userId
	);
	if (room.archivedAt !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot select an archived room",
		});
	}
	await validateAsset(db, params.userId, params.input.defaultAssetId);
	const version = await prepareCashRule(
		db,
		params.userId,
		null,
		params.input.rule
	);
	const statements: BatchStatement[] = [
		activeReferenceGuard(db, roomTable, params.input.roomId, params.userId),
		...(params.input.defaultAssetId
			? [
					activeReferenceGuard(
						db,
						asset,
						params.input.defaultAssetId,
						params.userId
					),
				]
			: []),
		...version.statements,
		db.insert(ringGame).values({
			currentRuleId: version.id,
			defaultAssetId: params.input.defaultAssetId ?? null,
			id: params.id,
			memo: params.input.memo ?? null,
			name: params.input.name,
			roomId: params.input.roomId,
			updatedAt: params.now,
			userId: params.userId,
		}),
		db
			.update(cashRule)
			.set({ ringGameId: params.id })
			.where(
				and(eq(cashRule.id, version.id), eq(cashRule.userId, params.userId))
			),
	];
	return { ruleId: version.id, statements };
}

async function hydrateRingGames(
	db: Database,
	userId: string,
	rows: (typeof ringGame.$inferSelect)[]
) {
	const { rules, lineups } = await hydrateCashRules(
		db,
		userId,
		rows.map((r) => r.currentRuleId)
	);
	return rows.map((row) => {
		const ruleVersion = rules.get(row.currentRuleId);
		if (!ruleVersion || ruleVersion.ringGameId !== row.id) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Invalid current ring game rule",
			});
		}
		const lineup = lineups[ruleVersion.lineupId];
		if (!lineup) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Missing rule lineup",
			});
		}
		return {
			archivedAt: row.archivedAt,
			createdAt: row.createdAt,
			currentRuleId: row.currentRuleId,
			defaultAssetId: row.defaultAssetId,
			id: row.id,
			lineups: { [ruleVersion.lineupId]: lineup },
			memo: row.memo,
			name: row.name,
			roomId: row.roomId,
			ruleVersion,
			updatedAt: row.updatedAt,
		};
	});
}
async function fetchRingGame(db: Database, userId: string, ringGameId: string) {
	const row = await validateEntityOwnership(db, "ringGame", ringGameId, userId);
	const [result] = await hydrateRingGames(db, userId, [row]);
	if (!result) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Missing ring game",
		});
	}
	return result;
}
const conflict = () =>
	new TRPCError({
		code: "CONFLICT",
		message:
			"This ring game is referenced. Archive the ring game instead of deleting it.",
	});

export const ringGameRouter = router({
	archive: protectedProcedure
		.input(ringGameIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ringGame", input.id, userId);
			await ctx.db
				.update(ringGame)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(and(eq(ringGame.id, input.id), eq(ringGame.userId, userId)));
			return fetchRingGame(ctx.db, userId, input.id);
		}),
	create: protectedProcedure
		.input(ringGameCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const gameId = crypto.randomUUID();
			const { statements } = await planRingGameCreate(ctx.db, {
				id: gameId,
				input,
				now: new Date(),
				userId,
			});
			await runGuardedBatch(ctx.db, statements);
			return fetchRingGame(ctx.db, userId, gameId);
		}),
	delete: protectedProcedure
		.input(ringGameIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ringGame", input.id, userId);
			try {
				const deleted = await ctx.db
					.delete(ringGame)
					.where(
						and(
							eq(ringGame.id, input.id),
							eq(ringGame.userId, userId),
							sql`NOT EXISTS (SELECT 1 FROM entry_cash e WHERE e.ring_game_id = ${ringGame.id} OR e.cash_rule_id IN (SELECT id FROM cash_rule WHERE ring_game_id = ${ringGame.id}))`,
							sql`NOT EXISTS (SELECT 1 FROM cash_rule child WHERE (child.ring_game_id IS NULL OR child.ring_game_id <> ${ringGame.id}) AND child.parent_rule_id IN (SELECT id FROM cash_rule WHERE ring_game_id = ${ringGame.id}))`
						)
					)
					.returning({ id: ringGame.id });
				if (!deleted.length) {
					throw conflict();
				}
			} catch (error) {
				if (isForeignKeyConstraintError(error)) {
					throw conflict();
				}
				throw error;
			}
			return { success: true };
		}),
	listByRoom: protectedProcedure
		.input(ringGameListByRoomInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "room", input.roomId, userId);
			const rows = await ctx.db
				.select()
				.from(ringGame)
				.where(
					and(
						eq(ringGame.userId, userId),
						eq(ringGame.roomId, input.roomId),
						input.includeArchived ? undefined : isNull(ringGame.archivedAt)
					)
				);
			return hydrateRingGames(ctx.db, userId, rows);
		}),
	restore: protectedProcedure
		.input(ringGameIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ringGame", input.id, userId);
			await ctx.db
				.update(ringGame)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(and(eq(ringGame.id, input.id), eq(ringGame.userId, userId)));
			return fetchRingGame(ctx.db, userId, input.id);
		}),
	restoreRule: protectedProcedure
		.input(ringGameRestoreRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await validateEntityOwnership(
				ctx.db,
				"ringGame",
				input.id,
				userId
			);
			await validateOwnedIds(ctx.db, cashRule, [input.ruleVersionId], userId);
			const [version] = await ctx.db
				.select()
				.from(cashRule)
				.where(
					and(eq(cashRule.id, input.ruleVersionId), eq(cashRule.userId, userId))
				);
			if (version?.ringGameId !== input.id) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Rule version belongs to another ring game",
				});
			}
			await runGuardedBatch(ctx.db, [
				ctx.db
					.update(ringGame)
					.set({ currentRuleId: version.id, updatedAt: new Date() })
					.where(
						and(
							eq(ringGame.id, input.id),
							eq(ringGame.userId, userId),
							eq(ringGame.currentRuleId, existing.currentRuleId)
						)
					),
				changedRowsGuardStatement(ctx.db, "ring-game-restore-rule"),
			]);
			return fetchRingGame(ctx.db, userId, input.id);
		}),
	update: protectedProcedure
		.input(ringGameUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await validateEntityOwnership(
				ctx.db,
				"ringGame",
				input.id,
				userId
			);
			await validateAsset(
				ctx.db,
				userId,
				input.defaultAssetId,
				existing.defaultAssetId
			);
			const version =
				input.rule === undefined
					? undefined
					: await prepareCashRule(
							ctx.db,
							userId,
							existing.id,
							input.rule,
							existing.currentRuleId
						);
			const statements: BatchStatement[] = [
				...(input.defaultAssetId &&
				input.defaultAssetId !== existing.defaultAssetId
					? [activeReferenceGuard(ctx.db, asset, input.defaultAssetId, userId)]
					: []),
				...(version?.statements ?? []),
				ctx.db
					.update(ringGame)
					.set({
						updatedAt: new Date(),
						...(input.name !== undefined && { name: input.name }),
						...(input.memo !== undefined && { memo: input.memo }),
						...(input.defaultAssetId !== undefined && {
							defaultAssetId: input.defaultAssetId,
						}),
						...(version && { currentRuleId: version.id }),
					})
					.where(
						and(
							eq(ringGame.id, input.id),
							eq(ringGame.userId, userId),
							version
								? eq(ringGame.currentRuleId, existing.currentRuleId)
								: undefined
						)
					),
				changedRowsGuardStatement(ctx.db, "ring-game-update"),
			];
			await runGuardedBatch(ctx.db, statements);
			return fetchRingGame(ctx.db, userId, input.id);
		}),
});
