import type { Database } from "@sapphire2/db";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { cashRule } from "@sapphire2/db/schema/rule";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { type BatchStatement, runBatch } from "../lib/batch";
import { isForeignKeyConstraintError } from "../lib/db-errors";
import { validateEntityOwnership, validateOwnedIds } from "../lib/ownership";
import {
	cashRuleInputSchema,
	hydrateCashRules,
	prepareCashRule,
} from "../services/cash-rules";

const id = z.string().min(1);
const name = z.string().trim().min(1).max(100);
export const ringGameListByRoomInputSchema = z.object({
	roomId: id,
	includeArchived: z.boolean().optional(),
});
export const ringGameIdInputSchema = z.object({ id });
export const ringGameCreateInputSchema = z.object({
	roomId: id,
	name,
	defaultAssetId: id.optional(),
	memo: z.string().optional(),
	rule: cashRuleInputSchema,
});
export const ringGameUpdateInputSchema = z.object({
	id,
	name: name.optional(),
	defaultAssetId: id.nullable().optional(),
	memo: z.string().nullable().optional(),
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
	const asset = await validateEntityOwnership(db, "asset", assetId, userId);
	if (asset.archivedAt && assetId !== current) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot select an archived asset",
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
	await validateEntityOwnership(db, "room", params.input.roomId, params.userId);
	await validateAsset(db, params.userId, params.input.defaultAssetId);
	const version = await prepareCashRule(
		db,
		params.userId,
		null,
		params.input.rule
	);
	const statements: BatchStatement[] = [
		...version.statements,
		db.insert(ringGame).values({
			id: params.id,
			userId: params.userId,
			roomId: params.input.roomId,
			name: params.input.name,
			defaultAssetId: params.input.defaultAssetId ?? null,
			memo: params.input.memo ?? null,
			currentRuleId: version.id,
			updatedAt: params.now,
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
			id: row.id,
			roomId: row.roomId,
			name: row.name,
			defaultAssetId: row.defaultAssetId,
			memo: row.memo,
			archivedAt: row.archivedAt,
			currentRuleId: row.currentRuleId,
			ruleVersion,
			lineups: { [ruleVersion.lineupId]: lineup },
			createdAt: row.createdAt,
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
	create: protectedProcedure
		.input(ringGameCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const gameId = crypto.randomUUID();
			const { statements } = await planRingGameCreate(ctx.db, {
				id: gameId,
				input,
				userId,
				now: new Date(),
			});
			await runBatch(ctx.db, statements);
			return fetchRingGame(ctx.db, userId, gameId);
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
					.where(and(eq(ringGame.id, input.id), eq(ringGame.userId, userId))),
			];
			await runBatch(ctx.db, statements);
			return fetchRingGame(ctx.db, userId, input.id);
		}),
	restoreRule: protectedProcedure
		.input(ringGameRestoreRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ringGame", input.id, userId);
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
			await ctx.db
				.update(ringGame)
				.set({ currentRuleId: version.id, updatedAt: new Date() })
				.where(and(eq(ringGame.id, input.id), eq(ringGame.userId, userId)));
			return fetchRingGame(ctx.db, userId, input.id);
		}),
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
});
