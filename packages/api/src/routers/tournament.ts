import { asset } from "@sapphire2/db/schema/asset";
import { room as roomTable } from "@sapphire2/db/schema/room";
import { tournamentRule } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import {
	tournamentTag,
	tournamentTagLink,
} from "@sapphire2/db/schema/tournament-tag";
import { idSchema } from "@sapphire2/db/schemas/id";
import { tagIdsSchema } from "@sapphire2/db/schemas/tag-ids";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, not, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { activeReferenceGuard } from "../lib/active-reference-guard";
import {
	type BatchStatement,
	insertChunks,
	selectInChunks,
} from "../lib/batch";
import { isForeignKeyConstraintError } from "../lib/db-errors";
import { memoSchema } from "../lib/master-input-schemas";
import {
	validateEntityOwnership,
	validateTagsOwnership,
} from "../lib/ownership";
import { changedRowsGuardStatement, runGuardedBatch } from "../lib/write-guard";
import { hydrateLineups, type LineupMap } from "../services/game-lineup";
import {
	hydrateTournamentRules,
	planTournamentRuleWrite,
	ruleLineupIds,
	type TournamentRuleOutput,
	tournamentRuleInputSchema,
	tournamentRuleWithLevelsInputSchema,
} from "../services/tournament-rule";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

type TournamentRow = typeof tournament.$inferSelect;

const nameSchema = z.string().trim().min(1).max(100);

export const tournamentListByRoomInputSchema = z.object({
	includeArchived: z.boolean().optional(),
	roomId: idSchema,
});

export const tournamentIdInputSchema = z.object({ id: idSchema });

const createFields = {
	defaultAssetId: idSchema.nullable().optional(),
	memo: memoSchema.nullable().optional(),
	name: nameSchema,
	roomId: idSchema,
	tagIds: tagIdsSchema.optional(),
};

const updateFields = {
	defaultAssetId: idSchema.nullable().optional(),
	id: idSchema,
	memo: memoSchema.nullable().optional(),
	name: nameSchema.optional(),
	tagIds: tagIdsSchema.optional(),
};

export const tournamentCreateInputSchema = z.object({
	...createFields,
	rule: tournamentRuleInputSchema,
});

export const tournamentCreateWithLevelsInputSchema = z.object({
	...createFields,
	rule: tournamentRuleWithLevelsInputSchema,
});

export const tournamentUpdateInputSchema = z.object({
	...updateFields,
	rule: tournamentRuleInputSchema.optional(),
});

export const tournamentUpdateWithLevelsInputSchema = z.object({
	...updateFields,
	rule: tournamentRuleWithLevelsInputSchema,
});

export const tournamentRestoreRuleInputSchema = z.object({
	id: idSchema,
	ruleVersionId: idSchema,
});

type TournamentCreateInput = z.infer<typeof tournamentCreateInputSchema>;
type TournamentUpdateInput = z.infer<typeof tournamentUpdateInputSchema>;

export interface TournamentOutput {
	archivedAt: Date | null;
	createdAt: Date;
	currentRuleId: string;
	defaultAssetId: string | null;
	id: string;
	lineups: LineupMap;
	memo: string | null;
	name: string;
	roomId: string | null;
	ruleVersion: TournamentRuleOutput;
	tags: { id: string; name: string }[];
	updatedAt: Date;
}

const TOURNAMENT_FORBIDDEN = "You do not own this tournament";

async function hydrateTournaments(
	db: DbInstance,
	userId: string,
	rows: TournamentRow[]
): Promise<TournamentOutput[]> {
	if (rows.length === 0) {
		return [];
	}
	const [rules, tags] = await Promise.all([
		hydrateTournamentRules(
			db,
			userId,
			rows.map((row) => row.currentRuleId)
		),
		selectInChunks(
			rows.map((row) => row.id),
			(chunk) =>
				db
					.select({
						id: tournamentTag.id,
						name: tournamentTag.name,
						tournamentId: tournamentTagLink.tournamentId,
					})
					.from(tournamentTagLink)
					.innerJoin(
						tournamentTag,
						and(
							eq(tournamentTag.id, tournamentTagLink.tagId),
							eq(tournamentTag.userId, tournamentTagLink.userId)
						)
					)
					.where(
						and(
							eq(tournamentTagLink.userId, userId),
							inArray(tournamentTagLink.tournamentId, chunk)
						)
					)
					.orderBy(asc(tournamentTag.sortOrder), asc(tournamentTag.id)),
			1
		),
	]);
	const lineups = await hydrateLineups(
		db,
		userId,
		[...rules.values()].flatMap(ruleLineupIds)
	);
	return rows.map((row) => {
		const rule = rules.get(row.currentRuleId);
		if (!rule) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "The tournament's current rule version is missing",
			});
		}
		const ruleLineups: LineupMap = {};
		for (const lineupId of ruleLineupIds(rule)) {
			const lineup = lineups[lineupId];
			if (lineup) {
				ruleLineups[lineupId] = lineup;
			}
		}
		return {
			archivedAt: row.archivedAt,
			createdAt: row.createdAt,
			currentRuleId: row.currentRuleId,
			defaultAssetId: row.defaultAssetId,
			id: row.id,
			lineups: ruleLineups,
			memo: row.memo,
			name: row.name,
			roomId: row.roomId,
			ruleVersion: rule,
			tags: tags
				.filter((tag) => tag.tournamentId === row.id)
				.map((tag) => ({ id: tag.id, name: tag.name })),
			updatedAt: row.updatedAt,
		};
	});
}

async function getTournament(
	db: DbInstance,
	userId: string,
	id: string
): Promise<TournamentOutput> {
	const [hydrated] = await hydrateTournaments(db, userId, [
		await validateEntityOwnership(db, "tournament", id, userId),
	]);
	if (!hydrated) {
		throw new TRPCError({ code: "FORBIDDEN", message: TOURNAMENT_FORBIDDEN });
	}
	return hydrated;
}

async function assertDefaultAsset(
	db: DbInstance,
	userId: string,
	assetId: string | null | undefined,
	currentAssetId: string | null
): Promise<void> {
	if (!assetId || assetId === currentAssetId) {
		return;
	}
	const found = await validateEntityOwnership(db, "asset", assetId, userId);
	if (found.archivedAt !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An archived asset cannot be newly selected",
		});
	}
}

function tagStatements(
	db: DbInstance,
	tournamentId: string,
	userId: string,
	tagIds: string[] | undefined,
	replace: boolean
): BatchStatement[] {
	if (tagIds === undefined) {
		return [];
	}
	return [
		...(replace
			? [
					db
						.delete(tournamentTagLink)
						.where(
							and(
								eq(tournamentTagLink.tournamentId, tournamentId),
								eq(tournamentTagLink.userId, userId)
							)
						),
				]
			: []),
		...insertChunks(
			tagIds.map((tagId) => ({ tagId, tournamentId, userId })),
			(chunk) => db.insert(tournamentTagLink).values(chunk)
		),
	];
}

export async function planTournamentCreate(
	db: DbInstance,
	userId: string,
	id: string,
	input: TournamentCreateInput
): Promise<{ ruleId: string; statements: BatchStatement[] }> {
	const room = await validateEntityOwnership(db, "room", input.roomId, userId);
	if (room.archivedAt !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot select an archived room",
		});
	}
	await validateTagsOwnership(db, tournamentTag, input.tagIds, userId);
	await assertDefaultAsset(db, userId, input.defaultAssetId, null);
	const write = await planTournamentRuleWrite({
		current: null,
		db,
		input: input.rule,
		tournamentId: null,
		userId,
	});
	const now = new Date();
	return {
		ruleId: write.ruleId,
		statements: [
			activeReferenceGuard(db, roomTable, input.roomId, userId),
			...(input.defaultAssetId
				? [activeReferenceGuard(db, asset, input.defaultAssetId, userId)]
				: []),
			...write.statements,
			db.insert(tournament).values({
				createdAt: now,
				currentRuleId: write.ruleId,
				defaultAssetId: input.defaultAssetId ?? null,
				id,
				memo: input.memo ?? null,
				name: input.name,
				roomId: input.roomId,
				updatedAt: now,
				userId,
			}),
			db
				.update(tournamentRule)
				.set({ tournamentId: id })
				.where(
					and(
						eq(tournamentRule.id, write.ruleId),
						eq(tournamentRule.userId, userId)
					)
				),
			...tagStatements(db, id, userId, input.tagIds, false),
		],
	};
}

async function createTournament(
	db: DbInstance,
	userId: string,
	input: TournamentCreateInput
): Promise<TournamentOutput> {
	const id = crypto.randomUUID();
	const { statements } = await planTournamentCreate(db, userId, id, input);
	await runGuardedBatch(db, statements);
	return await getTournament(db, userId, id);
}

async function updateTournament(
	db: DbInstance,
	userId: string,
	input: TournamentUpdateInput
): Promise<TournamentOutput> {
	const found = await validateEntityOwnership(
		db,
		"tournament",
		input.id,
		userId
	);
	await validateTagsOwnership(db, tournamentTag, input.tagIds, userId);
	await assertDefaultAsset(
		db,
		userId,
		input.defaultAssetId,
		found.defaultAssetId
	);
	let ruleStatements: BatchStatement[] = [];
	let currentRuleId = found.currentRuleId;
	if (input.rule) {
		const current = (
			await hydrateTournamentRules(db, userId, [found.currentRuleId])
		).get(found.currentRuleId);
		if (!current) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "The tournament's current rule version is missing",
			});
		}
		const write = await planTournamentRuleWrite({
			current,
			db,
			input: input.rule,
			tournamentId: found.id,
			userId,
		});
		ruleStatements = write.statements;
		currentRuleId = write.ruleId;
	}
	await runGuardedBatch(db, [
		...(input.defaultAssetId && input.defaultAssetId !== found.defaultAssetId
			? [activeReferenceGuard(db, asset, input.defaultAssetId, userId)]
			: []),
		...ruleStatements,
		db
			.update(tournament)
			.set({
				...(input.name === undefined ? {} : { name: input.name }),
				...(input.memo === undefined ? {} : { memo: input.memo }),
				...(input.defaultAssetId === undefined
					? {}
					: { defaultAssetId: input.defaultAssetId }),
				...(input.rule === undefined ? {} : { currentRuleId }),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(tournament.id, found.id),
					eq(tournament.userId, userId),
					input.rule
						? eq(tournament.currentRuleId, found.currentRuleId)
						: undefined
				)
			),
		changedRowsGuardStatement(db, "tournament-update"),
		...tagStatements(db, found.id, userId, input.tagIds, true),
	]);
	return await getTournament(db, userId, found.id);
}

const tournamentIsReferenced = sql<boolean>`(EXISTS (SELECT 1 FROM entry_tournament WHERE entry_tournament.user_id = tournament.user_id AND (entry_tournament.tournament_id = tournament.id OR entry_tournament.tournament_rule_id IN (SELECT tournament_rule.id FROM tournament_rule WHERE tournament_rule.tournament_id = tournament.id AND tournament_rule.user_id = tournament.user_id)))
OR EXISTS (SELECT 1 FROM ledger_line INNER JOIN tournament_rule_price ON tournament_rule_price.id = ledger_line.price_id AND tournament_rule_price.user_id = ledger_line.user_id INNER JOIN tournament_rule ON tournament_rule.id = tournament_rule_price.rule_id AND tournament_rule.user_id = tournament_rule_price.user_id WHERE tournament_rule.tournament_id = tournament.id AND tournament_rule.user_id = tournament.user_id)
OR EXISTS (SELECT 1 FROM tournament_rule AS child INNER JOIN tournament_rule AS parent ON parent.id = child.parent_rule_id AND parent.user_id = child.user_id WHERE parent.tournament_id = tournament.id AND parent.user_id = tournament.user_id AND (child.tournament_id IS NULL OR child.tournament_id <> tournament.id)))`;

export const tournamentRouter = router({
	archive: protectedProcedure
		.input(tournamentIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "tournament", input.id, userId);
			const now = new Date();
			await ctx.db
				.update(tournament)
				.set({ archivedAt: now, updatedAt: now })
				.where(and(eq(tournament.id, input.id), eq(tournament.userId, userId)));
			return await getTournament(ctx.db, userId, input.id);
		}),

	create: protectedProcedure
		.input(tournamentCreateInputSchema)
		.mutation(
			async ({ ctx, input }) =>
				await createTournament(ctx.db, ctx.session.user.id, input)
		),

	createWithLevels: protectedProcedure
		.input(tournamentCreateWithLevelsInputSchema)
		.mutation(
			async ({ ctx, input }) =>
				await createTournament(ctx.db, ctx.session.user.id, input)
		),

	delete: protectedProcedure
		.input(tournamentIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "tournament", input.id, userId);
			const conflict = () =>
				new TRPCError({
					code: "CONFLICT",
					message:
						"This tournament is referenced by entries or ledger lines. Archive the tournament instead of deleting it.",
				});
			try {
				const deleted = await ctx.db
					.delete(tournament)
					.where(
						and(
							eq(tournament.id, input.id),
							eq(tournament.userId, userId),
							not(tournamentIsReferenced)
						)
					)
					.returning({ id: tournament.id });
				if (deleted.length === 0) {
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

	getById: protectedProcedure
		.input(tournamentIdInputSchema)
		.query(
			async ({ ctx, input }) =>
				await getTournament(ctx.db, ctx.session.user.id, input.id)
		),
	listByRoom: protectedProcedure
		.input(tournamentListByRoomInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "room", input.roomId, userId);
			const rows = await ctx.db
				.select()
				.from(tournament)
				.where(
					and(
						eq(tournament.userId, userId),
						eq(tournament.roomId, input.roomId),
						input.includeArchived ? undefined : isNull(tournament.archivedAt)
					)
				);
			return await hydrateTournaments(ctx.db, userId, rows);
		}),

	restore: protectedProcedure
		.input(tournamentIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "tournament", input.id, userId);
			await ctx.db
				.update(tournament)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(and(eq(tournament.id, input.id), eq(tournament.userId, userId)));
			return await getTournament(ctx.db, userId, input.id);
		}),

	restoreRule: protectedProcedure
		.input(tournamentRestoreRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await validateEntityOwnership(
				ctx.db,
				"tournament",
				input.id,
				userId
			);
			const [version] = await ctx.db
				.select({ tournamentId: tournamentRule.tournamentId })
				.from(tournamentRule)
				.where(
					and(
						eq(tournamentRule.id, input.ruleVersionId),
						eq(tournamentRule.userId, userId)
					)
				);
			if (!version) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this rule version",
				});
			}
			if (version.tournamentId !== input.id) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This rule version belongs to another tournament",
				});
			}
			await runGuardedBatch(ctx.db, [
				ctx.db
					.update(tournament)
					.set({ currentRuleId: input.ruleVersionId, updatedAt: new Date() })
					.where(
						and(
							eq(tournament.id, input.id),
							eq(tournament.userId, userId),
							eq(tournament.currentRuleId, existing.currentRuleId)
						)
					),
				changedRowsGuardStatement(ctx.db, "tournament-restore-rule"),
			]);
			return await getTournament(ctx.db, userId, input.id);
		}),

	update: protectedProcedure
		.input(tournamentUpdateInputSchema)
		.mutation(
			async ({ ctx, input }) =>
				await updateTournament(ctx.db, ctx.session.user.id, input)
		),

	updateWithLevels: protectedProcedure
		.input(tournamentUpdateWithLevelsInputSchema)
		.mutation(
			async ({ ctx, input }) =>
				await updateTournament(ctx.db, ctx.session.user.id, input)
		),
});
