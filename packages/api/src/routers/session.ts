import { ringGame } from "@sapphire2/db/schema/ring-game";
import { pokerSession } from "@sapphire2/db/schema/session";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

const PAGE_SIZE = 20;

async function validateSessionOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	sessionId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.id, sessionId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Session not found",
		});
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this session",
		});
	}

	return found;
}

function computeCashGamePL(buyIn: number, cashOut: number): number {
	return cashOut - buyIn;
}

function computeTournamentPL(
	tournamentBuyIn: number | null,
	entryFee: number | null,
	rebuyCount: number | null,
	rebuyCost: number | null,
	addonCost: number | null,
	prizeMoney: number | null,
	bountyPrizes: number | null
): number {
	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost =
		(tournamentBuyIn ?? 0) +
		(entryFee ?? 0) +
		(rebuyCount ?? 0) * (rebuyCost ?? 0) +
		(addonCost ?? 0);
	return income - cost;
}

interface RingGameConfigInput {
	ante?: number | null;
	anteType?: "none" | "all" | "bb" | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	tableSize?: number | null;
	variant?: string;
}

function buildRingGameUpdateData(
	input: RingGameConfigInput
): Record<string, unknown> | null {
	const keys = [
		"variant",
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"anteType",
		"tableSize",
	] as const;
	const hasUpdate = keys.some((k) => input[k] !== undefined);
	if (!hasUpdate) {
		return null;
	}

	const data: Record<string, unknown> = { updatedAt: new Date() };
	for (const key of keys) {
		if (input[key] !== undefined) {
			data[key] = input[key];
		}
	}
	return data;
}

export {
	validateSessionOwnership,
	computeCashGamePL,
	computeTournamentPL,
	buildRingGameUpdateData,
};

const cashGameCreateSchema = z.object({
	type: z.literal("cash_game"),
	sessionDate: z.number(),
	buyIn: z.number().int().min(0),
	cashOut: z.number().int().min(0),
	// Ring game config (all optional)
	variant: z.string().default("nlh"),
	blind1: z.number().int().optional(),
	blind2: z.number().int().optional(),
	blind3: z.number().int().optional(),
	ante: z.number().int().optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	tableSize: z.number().int().optional(),
	// Time + memo
	startedAt: z.number().optional(),
	endedAt: z.number().optional(),
	memo: z.string().optional(),
	// Tags
	tagIds: z.array(z.string()).optional(),
});

const tournamentCreateSchema = z
	.object({
		type: z.literal("tournament"),
		sessionDate: z.number(),
		tournamentBuyIn: z.number().int().min(0),
		entryFee: z.number().int().min(0).default(0),
		placement: z.number().int().min(1).optional(),
		totalEntries: z.number().int().min(1).optional(),
		prizeMoney: z.number().int().min(0).optional(),
		rebuyCount: z.number().int().min(0).optional(),
		rebuyCost: z.number().int().min(0).optional(),
		addonCost: z.number().int().min(0).optional(),
		bountyPrizes: z.number().int().min(0).optional(),
		// Time + memo
		startedAt: z.number().optional(),
		endedAt: z.number().optional(),
		memo: z.string().optional(),
		// Tags
		tagIds: z.array(z.string()).optional(),
	})
	.refine(
		(data) => {
			if (data.placement !== undefined && data.totalEntries !== undefined) {
				return data.placement <= data.totalEntries;
			}
			return true;
		},
		{ message: "Placement must be less than or equal to total entries" }
	);

const createInputSchema = z.discriminatedUnion("type", [
	cashGameCreateSchema,
	tournamentCreateSchema,
]);

type CreateInput = z.infer<typeof createInputSchema>;

function buildCashGameSessionValues(
	input: Extract<CreateInput, { type: "cash_game" }>,
	ringGameId: string
): Partial<typeof pokerSession.$inferInsert> {
	return {
		buyIn: input.buyIn,
		cashOut: input.cashOut,
		ringGameId,
	};
}

function buildTournamentSessionValues(
	input: Extract<CreateInput, { type: "tournament" }>
): Partial<typeof pokerSession.$inferInsert> {
	return {
		tournamentBuyIn: input.tournamentBuyIn,
		entryFee: input.entryFee,
		placement: input.placement ?? null,
		totalEntries: input.totalEntries ?? null,
		prizeMoney: input.prizeMoney ?? null,
		rebuyCount: input.rebuyCount ?? null,
		rebuyCost: input.rebuyCost ?? null,
		addonCost: input.addonCost ?? null,
		bountyPrizes: input.bountyPrizes ?? null,
	};
}

function timestampToDate(ts: number | undefined): Date | null {
	return ts !== undefined ? new Date(ts * 1000) : null;
}

function nullableTimestampToDate(
	ts: number | null | undefined
): Date | null | undefined {
	if (ts === undefined) {
		return undefined;
	}
	return ts !== null ? new Date(ts * 1000) : null;
}

const SESSION_UPDATE_FIELDS = [
	"buyIn",
	"cashOut",
	"tournamentBuyIn",
	"entryFee",
	"placement",
	"totalEntries",
	"prizeMoney",
	"rebuyCount",
	"rebuyCost",
	"addonCost",
	"bountyPrizes",
	"memo",
] as const;

function buildSessionUpdateData(
	input: Record<string, unknown>
): Partial<typeof pokerSession.$inferInsert> {
	const data: Partial<typeof pokerSession.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.sessionDate !== undefined) {
		data.sessionDate = new Date((input.sessionDate as number) * 1000);
	}
	for (const field of SESSION_UPDATE_FIELDS) {
		if (input[field] !== undefined) {
			(data as Record<string, unknown>)[field] = input[field];
		}
	}
	const startedAt = nullableTimestampToDate(
		input.startedAt as number | null | undefined
	);
	if (startedAt !== undefined) {
		data.startedAt = startedAt;
	}
	const endedAt = nullableTimestampToDate(
		input.endedAt as number | null | undefined
	);
	if (endedAt !== undefined) {
		data.endedAt = endedAt;
	}
	return data;
}

export const sessionRouter = router({
	create: protectedProcedure
		.input(createInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			const now = new Date();

			let typeSpecificValues: Partial<typeof pokerSession.$inferInsert> = {};

			if (input.type === "cash_game") {
				const ringGameId = crypto.randomUUID();
				await ctx.db.insert(ringGame).values({
					id: ringGameId,
					storeId: null,
					name: `${input.variant ?? "nlh"} ${input.blind1 ?? 0}/${input.blind2 ?? 0}`,
					variant: input.variant ?? "nlh",
					blind1: input.blind1 ?? null,
					blind2: input.blind2 ?? null,
					blind3: input.blind3 ?? null,
					ante: input.ante ?? null,
					anteType: input.anteType ?? null,
					minBuyIn: null,
					maxBuyIn: null,
					tableSize: input.tableSize ?? null,
					updatedAt: now,
				});
				typeSpecificValues = buildCashGameSessionValues(input, ringGameId);
			} else {
				typeSpecificValues = buildTournamentSessionValues(input);
			}

			await ctx.db.insert(pokerSession).values({
				id,
				userId,
				type: input.type,
				sessionDate: new Date(input.sessionDate * 1000),
				startedAt: timestampToDate(input.startedAt),
				endedAt: timestampToDate(input.endedAt),
				memo: input.memo ?? null,
				updatedAt: now,
				...typeSpecificValues,
			});

			if (input.tagIds && input.tagIds.length > 0) {
				await ctx.db.insert(sessionToSessionTag).values(
					input.tagIds.map((tagId) => ({
						sessionId: id,
						sessionTagId: tagId,
					}))
				);
			}

			const [created] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, id));
			return created;
		}),

	list: protectedProcedure
		.input(z.object({ cursor: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const conditions = [eq(pokerSession.userId, userId)];
			if (input.cursor) {
				conditions.push(lt(pokerSession.id, input.cursor));
			}

			const data = await ctx.db
				.select({
					id: pokerSession.id,
					type: pokerSession.type,
					sessionDate: pokerSession.sessionDate,
					buyIn: pokerSession.buyIn,
					cashOut: pokerSession.cashOut,
					tournamentBuyIn: pokerSession.tournamentBuyIn,
					entryFee: pokerSession.entryFee,
					placement: pokerSession.placement,
					totalEntries: pokerSession.totalEntries,
					prizeMoney: pokerSession.prizeMoney,
					rebuyCount: pokerSession.rebuyCount,
					rebuyCost: pokerSession.rebuyCost,
					addonCost: pokerSession.addonCost,
					bountyPrizes: pokerSession.bountyPrizes,
					startedAt: pokerSession.startedAt,
					endedAt: pokerSession.endedAt,
					memo: pokerSession.memo,
					ringGameId: pokerSession.ringGameId,
					ringGameName: ringGame.name,
					createdAt: pokerSession.createdAt,
				})
				.from(pokerSession)
				.leftJoin(ringGame, eq(ringGame.id, pokerSession.ringGameId))
				.where(and(...conditions))
				.orderBy(desc(pokerSession.sessionDate), desc(pokerSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = data.length > PAGE_SIZE;
			const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
			const nextCursor = hasMore ? items.at(-1)?.id : undefined;

			const itemsWithPL = items.map((item) => {
				let profitLoss: number | null = null;
				if (
					item.type === "cash_game" &&
					item.buyIn !== null &&
					item.cashOut !== null
				) {
					profitLoss = computeCashGamePL(item.buyIn, item.cashOut);
				} else if (item.type === "tournament") {
					profitLoss = computeTournamentPL(
						item.tournamentBuyIn,
						item.entryFee,
						item.rebuyCount,
						item.rebuyCost,
						item.addonCost,
						item.prizeMoney,
						item.bountyPrizes
					);
				}
				return { ...item, profitLoss };
			});

			const sessionIds = itemsWithPL.map((item) => item.id);
			const tagLinks =
				sessionIds.length > 0
					? await ctx.db
							.select({
								sessionId: sessionToSessionTag.sessionId,
								tagId: sessionTag.id,
								tagName: sessionTag.name,
							})
							.from(sessionToSessionTag)
							.innerJoin(
								sessionTag,
								eq(sessionTag.id, sessionToSessionTag.sessionTagId)
							)
							.where(inArray(sessionToSessionTag.sessionId, sessionIds))
					: [];

			const itemsWithTags = itemsWithPL.map((item) => ({
				...item,
				tags: tagLinks
					.filter((tl) => tl.sessionId === item.id)
					.map((tl) => ({ id: tl.tagId, name: tl.tagName })),
			}));

			return { items: itemsWithTags, nextCursor };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);
			return session;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				sessionDate: z.number().optional(),
				// Cash game fields
				buyIn: z.number().int().min(0).optional(),
				cashOut: z.number().int().min(0).optional(),
				// Tournament fields
				tournamentBuyIn: z.number().int().min(0).optional(),
				entryFee: z.number().int().min(0).optional(),
				placement: z.number().int().min(1).nullable().optional(),
				totalEntries: z.number().int().min(1).nullable().optional(),
				prizeMoney: z.number().int().min(0).nullable().optional(),
				rebuyCount: z.number().int().min(0).nullable().optional(),
				rebuyCost: z.number().int().min(0).nullable().optional(),
				addonCost: z.number().int().min(0).nullable().optional(),
				bountyPrizes: z.number().int().min(0).nullable().optional(),
				// Common
				startedAt: z.number().nullable().optional(),
				endedAt: z.number().nullable().optional(),
				memo: z.string().nullable().optional(),
				// Ring game config updates
				variant: z.string().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				// Tags
				tagIds: z.array(z.string()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);

			const updateData = buildSessionUpdateData(input);

			await ctx.db
				.update(pokerSession)
				.set(updateData)
				.where(eq(pokerSession.id, input.id));

			// Update linked ringGame if game config fields provided
			const rgUpdateData = buildRingGameUpdateData(input);
			if (rgUpdateData && session.ringGameId) {
				await ctx.db
					.update(ringGame)
					.set(rgUpdateData)
					.where(eq(ringGame.id, session.ringGameId));
			}

			if (input.tagIds !== undefined) {
				await ctx.db
					.delete(sessionToSessionTag)
					.where(eq(sessionToSessionTag.sessionId, input.id));
				if (input.tagIds.length > 0) {
					await ctx.db.insert(sessionToSessionTag).values(
						input.tagIds.map((tagId) => ({
							sessionId: input.id,
							sessionTagId: tagId,
						}))
					);
				}
			}

			const [updated] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateSessionOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(pokerSession).where(eq(pokerSession.id, input.id));
			return { success: true };
		}),
});
