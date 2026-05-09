import { ringGame } from "@sapphire2/db/schema/ring-game";
import { ringGameBlindSet } from "@sapphire2/db/schema/ring-game-blind-set";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashBlindSet } from "@sapphire2/db/schema/session-cash-blind-set";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import {
	sessionChipPurchaseOption,
	sessionChipPurchaseRecord,
} from "@sapphire2/db/schema/session-chip-purchase-option";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionToSessionTag } from "@sapphire2/db/schema/session-tag";
import { sessionTournamentBlindSet } from "@sapphire2/db/schema/session-tournament-blind-set";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import {
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentBlindLevel } from "@sapphire2/db/schema/tournament-blind-level";
import { tournamentBlindSet } from "@sapphire2/db/schema/tournament-blind-set";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	computeCurrentPlayers,
	recalculate,
} from "../services/session-projection";
import {
	floorToMinute,
	nextAppendSortOrder,
} from "../utils/session-event-time";
import { assertLiveSession } from "../utils/session-guards";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function findLiveSession(db: DbInstance, id: string, userId: string) {
	const [found] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, id));

	if (!found) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
	}

	if (found.userId !== userId) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
	}

	assertLiveSession(found.source as "live" | "manual");

	return found;
}

function assertNotDiscarded(status: string): void {
	if (status === "discarded") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot modify a discarded session",
		});
	}
}

// ---------------------------------------------------------------------------
// Shared blind set schema (mirrors session.ts)
// ---------------------------------------------------------------------------

const blindSetSchema = z.object({
	limitFormatId: z.number().int().min(1),
	blind1: z.number().int().min(0),
	blind2: z.number().int().min(0),
	blind3: z.number().int().min(0).optional(),
	blind4: z.number().int().min(0).optional(),
	ante: z.number().int().min(0).optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	sortOrder: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// create input schemas
// ---------------------------------------------------------------------------

const liveCashRule = z.object({
	ruleName: z.string().min(1),
	minBuyIn: z.number().int().min(0).optional(),
	maxBuyIn: z.number().int().min(0).optional(),
	tableSize: z.number().int().min(1).optional(),
	variantId: z.number().int().min(1),
	blindSets: z.array(blindSetSchema).optional(),
});

const liveTournamentBlindLevelSchema = z.object({
	levelIndex: z.number().int().min(0),
	isBreak: z.boolean(),
	minutes: z.number().int().min(1).optional(),
	sortOrder: z.number().int().min(0),
	blindSets: z.array(blindSetSchema).optional(),
});

const liveTournamentRule = z.object({
	ruleName: z.string().min(1),
	startingStack: z.number().int().min(0).optional(),
	bountyAmount: z.number().int().min(0).optional(),
	tableSize: z.number().int().min(1).optional(),
	buyIn: z.number().int().min(0),
	entryFee: z.number().int().min(0).default(0),
	variantId: z.number().int().min(1),
	blindLevels: z.array(liveTournamentBlindLevelSchema).optional(),
});

const chipPurchaseOptionSchema = z.object({
	name: z.string().min(1),
	cost: z.number().int().min(0),
	chips: z.number().int().min(0),
	sortOrder: z.number().int().min(0),
});

const createCashSchema = z.object({
	kind: z.literal("cash_game"),
	sessionDate: z.string(),
	startedAt: z.date().optional(),
	storeId: z.string().optional(),
	currencyId: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	memo: z.string().optional(),
	// Either provide an existing ring game master ID, or provide rule directly
	ringGameId: z.string().optional(),
	rule: liveCashRule.optional(),
	buyInAmount: z.number().int().min(0),
});

const createTournamentSchema = z.object({
	kind: z.literal("tournament"),
	sessionDate: z.string(),
	startedAt: z.date().optional(),
	storeId: z.string().optional(),
	currencyId: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	memo: z.string().optional(),
	// Either provide an existing tournament master ID, or provide rule directly
	tournamentId: z.string().optional(),
	rule: liveTournamentRule.optional(),
	chipPurchaseOptions: z.array(chipPurchaseOptionSchema).optional(),
	timerStartedAt: z.date().optional(),
});

const createInputSchema = z.discriminatedUnion("kind", [
	createCashSchema,
	createTournamentSchema,
]);

// ---------------------------------------------------------------------------
// Helpers for copying master data into session snapshot
// ---------------------------------------------------------------------------

async function copyRingGameToSession(
	db: DbInstance,
	sessionId: string,
	ringGameId: string
): Promise<{
	ruleName: string;
	variantId: number;
	minBuyIn: number | null;
	maxBuyIn: number | null;
	tableSize: number | null;
}> {
	const [rg] = await db
		.select()
		.from(ringGame)
		.where(eq(ringGame.id, ringGameId));
	if (!rg) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Ring game not found" });
	}
	if (!rg.variantId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ring game has no variant assigned; set variantId first",
		});
	}

	const blindSets = await db
		.select()
		.from(ringGameBlindSet)
		.where(eq(ringGameBlindSet.ringGameId, ringGameId))
		.orderBy(asc(ringGameBlindSet.sortOrder));

	for (const bs of blindSets) {
		await db.insert(sessionCashBlindSet).values({
			sessionId,
			limitFormatId: bs.limitFormatId,
			blind1: bs.blind1,
			blind2: bs.blind2,
			blind3: bs.blind3 ?? undefined,
			blind4: bs.blind4 ?? undefined,
			ante: bs.ante ?? undefined,
			anteType: bs.anteType ?? undefined,
			sortOrder: bs.sortOrder,
		});
	}

	return {
		ruleName: rg.name,
		variantId: rg.variantId,
		minBuyIn: rg.minBuyIn ?? null,
		maxBuyIn: rg.maxBuyIn ?? null,
		tableSize: rg.tableSize ?? null,
	};
}

async function copyTournamentToSession(
	db: DbInstance,
	sessionId: string,
	tournamentId: string
): Promise<{
	ruleName: string;
	variantId: number;
	startingStack: number | null;
	bountyAmount: number | null;
	tableSize: number | null;
	buyIn: number;
	entryFee: number;
}> {
	const [t] = await db
		.select()
		.from(tournament)
		.where(eq(tournament.id, tournamentId));
	if (!t) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" });
	}
	if (!t.variantId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Tournament has no variant assigned; set variantId first",
		});
	}

	const levels = await db
		.select()
		.from(tournamentBlindLevel)
		.where(eq(tournamentBlindLevel.tournamentId, tournamentId))
		.orderBy(asc(tournamentBlindLevel.sortOrder));

	for (const level of levels) {
		const [inserted] = await db
			.insert(sessionBlindLevel)
			.values({
				sessionId,
				levelIndex: level.levelIndex,
				isBreak: level.isBreak,
				minutes: level.minutes ?? undefined,
				sortOrder: level.sortOrder,
			})
			.returning({ id: sessionBlindLevel.id });

		if (!inserted) {
			continue;
		}

		const sets = await db
			.select()
			.from(tournamentBlindSet)
			.where(eq(tournamentBlindSet.tournamentBlindLevelId, level.id))
			.orderBy(asc(tournamentBlindSet.sortOrder));

		for (const bs of sets) {
			await db.insert(sessionTournamentBlindSet).values({
				sessionBlindLevelId: inserted.id,
				limitFormatId: bs.limitFormatId,
				blind1: bs.blind1,
				blind2: bs.blind2,
				blind3: bs.blind3 ?? undefined,
				blind4: bs.blind4 ?? undefined,
				ante: bs.ante ?? undefined,
				anteType: bs.anteType ?? undefined,
				sortOrder: bs.sortOrder,
			});
		}
	}

	// Copy chip purchase options
	const chipOptions = await db
		.select()
		.from(tournamentChipPurchase)
		.where(eq(tournamentChipPurchase.tournamentId, tournamentId))
		.orderBy(asc(tournamentChipPurchase.sortOrder));

	for (const opt of chipOptions) {
		await db.insert(sessionChipPurchaseOption).values({
			sessionId,
			name: opt.name,
			cost: opt.cost,
			chips: opt.chips,
			sortOrder: opt.sortOrder,
		});
	}

	return {
		ruleName: t.name,
		variantId: t.variantId,
		startingStack: t.startingStack ?? null,
		bountyAmount: t.bountyAmount ?? null,
		tableSize: t.tableSize ?? null,
		buyIn: t.buyIn ?? 0,
		entryFee: t.entryFee ?? 0,
	};
}

async function insertRuleBlindSetsForCash(
	db: DbInstance,
	sessionId: string,
	blindSets: Array<{
		limitFormatId: number;
		blind1: number;
		blind2: number;
		blind3?: number;
		blind4?: number;
		ante?: number;
		anteType?: string;
		sortOrder: number;
	}>
): Promise<void> {
	for (const bs of blindSets) {
		await db.insert(sessionCashBlindSet).values({
			sessionId,
			limitFormatId: bs.limitFormatId,
			blind1: bs.blind1,
			blind2: bs.blind2,
			blind3: bs.blind3,
			blind4: bs.blind4,
			ante: bs.ante,
			anteType: bs.anteType,
			sortOrder: bs.sortOrder,
		});
	}
}

async function insertRuleBlindLevelsForTournament(
	db: DbInstance,
	sessionId: string,
	blindLevels: Array<{
		levelIndex: number;
		isBreak: boolean;
		minutes?: number;
		sortOrder: number;
		blindSets?: Array<{
			limitFormatId: number;
			blind1: number;
			blind2: number;
			blind3?: number;
			blind4?: number;
			ante?: number;
			anteType?: string;
			sortOrder: number;
		}>;
	}>
): Promise<void> {
	for (const level of blindLevels) {
		const [inserted] = await db
			.insert(sessionBlindLevel)
			.values({
				sessionId,
				levelIndex: level.levelIndex,
				isBreak: level.isBreak,
				minutes: level.minutes,
				sortOrder: level.sortOrder,
			})
			.returning({ id: sessionBlindLevel.id });

		if (!inserted) {
			continue;
		}

		for (const bs of level.blindSets ?? []) {
			await db.insert(sessionTournamentBlindSet).values({
				sessionBlindLevelId: inserted.id,
				limitFormatId: bs.limitFormatId,
				blind1: bs.blind1,
				blind2: bs.blind2,
				blind3: bs.blind3,
				blind4: bs.blind4,
				ante: bs.ante,
				anteType: bs.anteType,
				sortOrder: bs.sortOrder,
			});
		}
	}
}

// ---------------------------------------------------------------------------
// create helpers (split out to stay under cognitive complexity limit)
// ---------------------------------------------------------------------------

type CreateInput = z.infer<typeof createInputSchema>;

async function createCashSession(
	db: DbInstance,
	id: string,
	now: Date,
	input: Extract<CreateInput, { kind: "cash_game" }>
): Promise<void> {
	let ruleName: string;
	let variantId: number;
	let minBuyIn: number | null = null;
	let maxBuyIn: number | null = null;
	let tableSize: number | null = null;
	const ringGameId: string | null = input.ringGameId ?? null;

	if (input.ringGameId) {
		const copied = await copyRingGameToSession(db, id, input.ringGameId);
		ruleName = copied.ruleName;
		variantId = copied.variantId;
		minBuyIn = copied.minBuyIn;
		maxBuyIn = copied.maxBuyIn;
		tableSize = copied.tableSize;
	} else if (input.rule) {
		ruleName = input.rule.ruleName;
		variantId = input.rule.variantId;
		minBuyIn = input.rule.minBuyIn ?? null;
		maxBuyIn = input.rule.maxBuyIn ?? null;
		tableSize = input.rule.tableSize ?? null;
		if (input.rule.blindSets) {
			await insertRuleBlindSetsForCash(db, id, input.rule.blindSets);
		}
	} else {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Either ringGameId or rule must be provided for cash game",
		});
	}

	await db.insert(sessionCashDetail).values({
		sessionId: id,
		ringGameId,
		ruleName,
		variantId,
		minBuyIn,
		maxBuyIn,
		tableSize,
	});

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId: id,
		eventType: "session_start",
		occurredAt: floorToMinute(now),
		sortOrder: 0,
		payload: JSON.stringify({ buyInAmount: input.buyInAmount }),
		updatedAt: now,
	});
}

async function createTournamentSession(
	db: DbInstance,
	id: string,
	now: Date,
	input: Extract<CreateInput, { kind: "tournament" }>
): Promise<void> {
	let ruleName: string;
	let variantId: number;
	let startingStack: number | null = null;
	let bountyAmount: number | null = null;
	let tableSize: number | null = null;
	let buyIn = 0;
	let entryFee = 0;
	const tournamentId: string | null = input.tournamentId ?? null;

	if (input.tournamentId) {
		const copied = await copyTournamentToSession(db, id, input.tournamentId);
		ruleName = copied.ruleName;
		variantId = copied.variantId;
		startingStack = copied.startingStack;
		bountyAmount = copied.bountyAmount;
		tableSize = copied.tableSize;
		buyIn = copied.buyIn;
		entryFee = copied.entryFee;
	} else if (input.rule) {
		ruleName = input.rule.ruleName;
		variantId = input.rule.variantId;
		startingStack = input.rule.startingStack ?? null;
		bountyAmount = input.rule.bountyAmount ?? null;
		tableSize = input.rule.tableSize ?? null;
		buyIn = input.rule.buyIn;
		entryFee = input.rule.entryFee ?? 0;
		if (input.rule.blindLevels) {
			await insertRuleBlindLevelsForTournament(db, id, input.rule.blindLevels);
		}
	} else {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Either tournamentId or rule must be provided for tournament",
		});
	}

	// Copy chip purchase options from input (if rule-based create)
	if (!input.tournamentId && input.chipPurchaseOptions) {
		for (const opt of input.chipPurchaseOptions) {
			await db.insert(sessionChipPurchaseOption).values({
				sessionId: id,
				name: opt.name,
				cost: opt.cost,
				chips: opt.chips,
				sortOrder: opt.sortOrder,
			});
		}
	}

	await db.insert(sessionTournamentDetail).values({
		sessionId: id,
		tournamentId,
		ruleName,
		variantId,
		startingStack,
		bountyAmount,
		tableSize,
		buyIn,
		entryFee,
		timerStartedAt: input.timerStartedAt ?? null,
	});

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId: id,
		eventType: "session_start",
		occurredAt: floorToMinute(now),
		sortOrder: 0,
		payload: JSON.stringify({}),
		updatedAt: now,
	});
}

// ---------------------------------------------------------------------------
// updateRule helpers
// ---------------------------------------------------------------------------

interface UpdateCashRuleInput {
	id: string;
	kind: "cash_game";
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	ringGameId?: string | null;
	ruleName?: string;
	tableSize?: number | null;
	variantId?: number;
}

interface UpdateTournamentRuleInput {
	bountyAmount?: number | null;
	buyIn?: number;
	entryFee?: number;
	id: string;
	kind: "tournament";
	ruleName?: string;
	startingStack?: number | null;
	tableSize?: number | null;
	timerStartedAt?: Date | null;
	tournamentId?: string | null;
	variantId?: number;
}

async function applyUpdateCashRule(
	db: DbInstance,
	sessionId: string,
	input: UpdateCashRuleInput
): Promise<void> {
	const update: Partial<typeof sessionCashDetail.$inferInsert> = {};
	if (input.ruleName !== undefined) {
		update.ruleName = input.ruleName;
	}
	if (input.minBuyIn !== undefined) {
		update.minBuyIn = input.minBuyIn;
	}
	if (input.maxBuyIn !== undefined) {
		update.maxBuyIn = input.maxBuyIn;
	}
	if (input.tableSize !== undefined) {
		update.tableSize = input.tableSize;
	}
	if (input.variantId !== undefined) {
		update.variantId = input.variantId;
	}
	if (input.ringGameId !== undefined) {
		update.ringGameId = input.ringGameId;
	}

	if (Object.keys(update).length > 0) {
		await db
			.update(sessionCashDetail)
			.set(update)
			.where(eq(sessionCashDetail.sessionId, sessionId));
	}
}

async function applyUpdateTournamentRule(
	db: DbInstance,
	sessionId: string,
	input: UpdateTournamentRuleInput
): Promise<void> {
	const update: Partial<typeof sessionTournamentDetail.$inferInsert> = {};
	if (input.ruleName !== undefined) {
		update.ruleName = input.ruleName;
	}
	if (input.startingStack !== undefined) {
		update.startingStack = input.startingStack;
	}
	if (input.bountyAmount !== undefined) {
		update.bountyAmount = input.bountyAmount;
	}
	if (input.tableSize !== undefined) {
		update.tableSize = input.tableSize;
	}
	if (input.variantId !== undefined) {
		update.variantId = input.variantId;
	}
	if (input.buyIn !== undefined) {
		update.buyIn = input.buyIn;
	}
	if (input.entryFee !== undefined) {
		update.entryFee = input.entryFee;
	}
	if (input.tournamentId !== undefined) {
		update.tournamentId = input.tournamentId;
	}
	if (input.timerStartedAt !== undefined) {
		update.timerStartedAt = input.timerStartedAt;
	}

	if (Object.keys(update).length > 0) {
		await db
			.update(sessionTournamentDetail)
			.set(update)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
	}
}

// ---------------------------------------------------------------------------
// updateBlindSet helpers
// ---------------------------------------------------------------------------

interface BlindSetFields {
	ante?: number | null;
	anteType?: "none" | "all" | "bb" | null;
	blind1?: number;
	blind2?: number;
	blind3?: number | null;
	blind4?: number | null;
	limitFormatId?: number;
	sortOrder?: number;
}

async function applyUpdateTournamentBlindSet(
	db: DbInstance,
	id: number,
	userId: string,
	fields: BlindSetFields
): Promise<string> {
	const [bs] = await db
		.select()
		.from(sessionTournamentBlindSet)
		.where(eq(sessionTournamentBlindSet.id, id));

	if (!bs) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Blind set not found" });
	}

	const [level] = await db
		.select()
		.from(sessionBlindLevel)
		.where(eq(sessionBlindLevel.id, bs.sessionBlindLevelId));

	if (!level) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Blind level not found",
		});
	}

	await findLiveSession(db, level.sessionId, userId);

	const update: Partial<typeof sessionTournamentBlindSet.$inferInsert> = {};
	if (fields.limitFormatId !== undefined) {
		update.limitFormatId = fields.limitFormatId;
	}
	if (fields.blind1 !== undefined) {
		update.blind1 = fields.blind1;
	}
	if (fields.blind2 !== undefined) {
		update.blind2 = fields.blind2;
	}
	if (fields.blind3 !== undefined) {
		update.blind3 = fields.blind3;
	}
	if (fields.blind4 !== undefined) {
		update.blind4 = fields.blind4;
	}
	if (fields.ante !== undefined) {
		update.ante = fields.ante;
	}
	if (fields.anteType !== undefined) {
		update.anteType = fields.anteType;
	}
	if (fields.sortOrder !== undefined) {
		update.sortOrder = fields.sortOrder;
	}

	if (Object.keys(update).length > 0) {
		await db
			.update(sessionTournamentBlindSet)
			.set(update)
			.where(eq(sessionTournamentBlindSet.id, id));
	}

	await recalculate(db, level.sessionId);
	return level.sessionId;
}

async function applyUpdateCashBlindSet(
	db: DbInstance,
	id: number,
	userId: string,
	fields: BlindSetFields
): Promise<string> {
	const [bs] = await db
		.select()
		.from(sessionCashBlindSet)
		.where(eq(sessionCashBlindSet.id, id));

	if (!bs) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Blind set not found" });
	}

	await findLiveSession(db, bs.sessionId, userId);

	const update: Partial<typeof sessionCashBlindSet.$inferInsert> = {};
	if (fields.limitFormatId !== undefined) {
		update.limitFormatId = fields.limitFormatId;
	}
	if (fields.blind1 !== undefined) {
		update.blind1 = fields.blind1;
	}
	if (fields.blind2 !== undefined) {
		update.blind2 = fields.blind2;
	}
	if (fields.blind3 !== undefined) {
		update.blind3 = fields.blind3;
	}
	if (fields.blind4 !== undefined) {
		update.blind4 = fields.blind4;
	}
	if (fields.ante !== undefined) {
		update.ante = fields.ante;
	}
	if (fields.anteType !== undefined) {
		update.anteType = fields.anteType;
	}
	if (fields.sortOrder !== undefined) {
		update.sortOrder = fields.sortOrder;
	}

	if (Object.keys(update).length > 0) {
		await db
			.update(sessionCashBlindSet)
			.set(update)
			.where(eq(sessionCashBlindSet.id, id));
	}

	await recalculate(db, bs.sessionId);
	return bs.sessionId;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const liveSessionRouter = router({
	create: protectedProcedure
		.input(createInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const now = input.startedAt ?? new Date();
			const sessionDate = new Date(input.sessionDate);
			const id = crypto.randomUUID();

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: input.kind,
				status: "active",
				source: "live",
				storeId: input.storeId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				sessionDate,
				updatedAt: now,
			});

			if (input.kind === "cash_game") {
				await createCashSession(ctx.db, id, now, input);
			} else {
				await createTournamentSession(ctx.db, id, now, input);
			}

			// Apply tags
			if (input.tagIds && input.tagIds.length > 0) {
				for (const tagId of input.tagIds) {
					await ctx.db
						.insert(sessionToSessionTag)
						.values({ sessionId: id, sessionTagId: tagId });
				}
			}

			return { id };
		}),

	complete: protectedProcedure
		.input(
			z.discriminatedUnion("kind", [
				z.object({
					id: z.string(),
					kind: z.literal("cash_game"),
					finalStack: z.number().int().min(0),
				}),
				z.object({
					id: z.string(),
					kind: z.literal("tournament"),
					beforeDeadline: z.boolean(),
					placement: z.number().int().min(1).optional(),
					totalEntries: z.number().int().min(1).optional(),
					prizeMoney: z.number().int().min(0).optional(),
					bountyPrizes: z.number().int().min(0).optional(),
				}),
			])
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			if (session.status === "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session is already completed",
				});
			}

			const now = new Date();
			const sortOrder = await nextAppendSortOrder(ctx.db, input.id);

			let payload: string;
			if (input.kind === "cash_game") {
				payload = JSON.stringify({ cashOutAmount: input.finalStack });
			} else if (input.beforeDeadline) {
				payload = JSON.stringify({
					beforeDeadline: true,
					prizeMoney: input.prizeMoney ?? 0,
					bountyPrizes: input.bountyPrizes ?? 0,
				});
			} else {
				if (!(input.placement && input.totalEntries)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"placement and totalEntries are required when beforeDeadline is false",
					});
				}
				payload = JSON.stringify({
					beforeDeadline: false,
					placement: input.placement,
					totalEntries: input.totalEntries,
					prizeMoney: input.prizeMoney ?? 0,
					bountyPrizes: input.bountyPrizes ?? 0,
				});
			}

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "session_end",
				occurredAt: floorToMinute(now),
				sortOrder,
				payload,
				updatedAt: now,
			});

			await recalculate(ctx.db, input.id);

			return { id: input.id };
		}),

	reopen: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			if (session.status !== "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session is not completed",
				});
			}

			// Delete the last session_end event
			const [endEvent] = await ctx.db
				.select({ id: sessionEvent.id })
				.from(sessionEvent)
				.where(
					and(
						eq(sessionEvent.sessionId, input.id),
						eq(sessionEvent.eventType, "session_end")
					)
				)
				.orderBy(desc(sessionEvent.sortOrder))
				.limit(1);

			if (!endEvent) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Session end event not found",
				});
			}

			await ctx.db.delete(sessionEvent).where(eq(sessionEvent.id, endEvent.id));
			await recalculate(ctx.db, input.id);

			return { id: input.id };
		}),

	discard: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			await ctx.db
				.update(gameSession)
				.set({ status: "discarded", updatedAt: new Date() })
				.where(eq(gameSession.id, input.id));

			return { id: input.id };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				memo: z.string().nullable().optional(),
				sessionDate: z.string().optional(),
				storeId: z.string().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				tagIds: z.array(z.string()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			const updateData: Partial<typeof gameSession.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}
			if (input.sessionDate !== undefined) {
				updateData.sessionDate = new Date(input.sessionDate);
			}
			if (input.storeId !== undefined) {
				updateData.storeId = input.storeId;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}

			await ctx.db
				.update(gameSession)
				.set(updateData)
				.where(eq(gameSession.id, input.id));

			if (input.tagIds !== undefined) {
				await ctx.db
					.delete(sessionToSessionTag)
					.where(eq(sessionToSessionTag.sessionId, input.id));
				for (const tagId of input.tagIds) {
					await ctx.db
						.insert(sessionToSessionTag)
						.values({ sessionId: input.id, sessionTagId: tagId });
				}
			}

			return { id: input.id };
		}),

	updateRule: protectedProcedure
		.input(
			z.discriminatedUnion("kind", [
				z.object({
					id: z.string(),
					kind: z.literal("cash_game"),
					ruleName: z.string().min(1).optional(),
					minBuyIn: z.number().int().min(0).nullable().optional(),
					maxBuyIn: z.number().int().min(0).nullable().optional(),
					tableSize: z.number().int().min(1).nullable().optional(),
					variantId: z.number().int().min(1).optional(),
					ringGameId: z.string().nullable().optional(),
				}),
				z.object({
					id: z.string(),
					kind: z.literal("tournament"),
					ruleName: z.string().min(1).optional(),
					startingStack: z.number().int().min(0).nullable().optional(),
					bountyAmount: z.number().int().min(0).nullable().optional(),
					tableSize: z.number().int().min(1).nullable().optional(),
					variantId: z.number().int().min(1).optional(),
					buyIn: z.number().int().min(0).optional(),
					entryFee: z.number().int().min(0).optional(),
					tournamentId: z.string().nullable().optional(),
					timerStartedAt: z.date().nullable().optional(),
				}),
			])
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			if (input.kind === "cash_game") {
				await applyUpdateCashRule(ctx.db, input.id, input);
			} else {
				await applyUpdateTournamentRule(ctx.db, input.id, input);
			}

			return { id: input.id };
		}),

	// ---------------------------------------------------------------------------
	// Blind level CRUD
	// ---------------------------------------------------------------------------

	addBlindLevel: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				levelIndex: z.number().int().min(0),
				isBreak: z.boolean(),
				minutes: z.number().int().min(1).optional(),
				sortOrder: z.number().int().min(0),
				blindSets: z.array(blindSetSchema).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.sessionId, userId);
			assertNotDiscarded(session.status);

			const [inserted] = await ctx.db
				.insert(sessionBlindLevel)
				.values({
					sessionId: input.sessionId,
					levelIndex: input.levelIndex,
					isBreak: input.isBreak,
					minutes: input.minutes,
					sortOrder: input.sortOrder,
				})
				.returning({ id: sessionBlindLevel.id });

			if (!inserted) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Insert failed",
				});
			}

			for (const bs of input.blindSets ?? []) {
				await ctx.db.insert(sessionTournamentBlindSet).values({
					sessionBlindLevelId: inserted.id,
					limitFormatId: bs.limitFormatId,
					blind1: bs.blind1,
					blind2: bs.blind2,
					blind3: bs.blind3,
					blind4: bs.blind4,
					ante: bs.ante,
					anteType: bs.anteType,
					sortOrder: bs.sortOrder,
				});
			}

			await recalculate(ctx.db, input.sessionId);
			return { id: inserted.id };
		}),

	updateBlindLevel: protectedProcedure
		.input(
			z.object({
				id: z.number().int(),
				levelIndex: z.number().int().min(0).optional(),
				isBreak: z.boolean().optional(),
				minutes: z.number().int().min(1).nullable().optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [level] = await ctx.db
				.select()
				.from(sessionBlindLevel)
				.where(eq(sessionBlindLevel.id, input.id));

			if (!level) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Blind level not found",
				});
			}

			await findLiveSession(ctx.db, level.sessionId, userId);

			const update: Partial<typeof sessionBlindLevel.$inferInsert> = {};
			if (input.levelIndex !== undefined) {
				update.levelIndex = input.levelIndex;
			}
			if (input.isBreak !== undefined) {
				update.isBreak = input.isBreak;
			}
			if (input.minutes !== undefined) {
				update.minutes = input.minutes;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			if (Object.keys(update).length > 0) {
				await ctx.db
					.update(sessionBlindLevel)
					.set(update)
					.where(eq(sessionBlindLevel.id, input.id));
			}

			await recalculate(ctx.db, level.sessionId);
			return { id: input.id };
		}),

	removeBlindLevel: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [level] = await ctx.db
				.select()
				.from(sessionBlindLevel)
				.where(eq(sessionBlindLevel.id, input.id));

			if (!level) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Blind level not found",
				});
			}

			await findLiveSession(ctx.db, level.sessionId, userId);

			// Guard: check if any events reference this blind level by levelIndex
			// (events with update_stack or session_start that set current level)
			// For now we check session_start events that have a currentLevelId field
			// The actual guard per the plan: events that reference this level's levelIndex
			// We check session events that have a "currentBlindLevelId" in their payload
			const events = await ctx.db
				.select({ payload: sessionEvent.payload })
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, level.sessionId));

			for (const evt of events) {
				try {
					const parsed = JSON.parse(evt.payload) as Record<string, unknown>;
					if (parsed.currentBlindLevelId === input.id) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"Blind level is referenced by an event and cannot be removed",
						});
					}
				} catch (e) {
					if (e instanceof TRPCError) {
						throw e;
					}
				}
			}

			await ctx.db
				.delete(sessionBlindLevel)
				.where(eq(sessionBlindLevel.id, input.id));

			await recalculate(ctx.db, level.sessionId);
			return { success: true };
		}),

	// ---------------------------------------------------------------------------
	// Blind set CRUD (tournament blind sets under a blind level)
	// ---------------------------------------------------------------------------

	addBlindSet: protectedProcedure
		.input(
			z.union([
				// Tournament: under a session blind level
				z.object({
					sessionBlindLevelId: z.number().int(),
					limitFormatId: z.number().int().min(1),
					blind1: z.number().int().min(0),
					blind2: z.number().int().min(0),
					blind3: z.number().int().min(0).optional(),
					blind4: z.number().int().min(0).optional(),
					ante: z.number().int().min(0).optional(),
					anteType: z.enum(["none", "all", "bb"]).optional(),
					sortOrder: z.number().int().min(0),
				}),
				// Cash: directly under a session
				z.object({
					sessionId: z.string(),
					limitFormatId: z.number().int().min(1),
					blind1: z.number().int().min(0),
					blind2: z.number().int().min(0),
					blind3: z.number().int().min(0).optional(),
					blind4: z.number().int().min(0).optional(),
					ante: z.number().int().min(0).optional(),
					anteType: z.enum(["none", "all", "bb"]).optional(),
					sortOrder: z.number().int().min(0),
				}),
			])
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			if ("sessionBlindLevelId" in input) {
				const [level] = await ctx.db
					.select()
					.from(sessionBlindLevel)
					.where(eq(sessionBlindLevel.id, input.sessionBlindLevelId));

				if (!level) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Blind level not found",
					});
				}

				const session = await findLiveSession(ctx.db, level.sessionId, userId);
				assertNotDiscarded(session.status);

				const [inserted] = await ctx.db
					.insert(sessionTournamentBlindSet)
					.values({
						sessionBlindLevelId: input.sessionBlindLevelId,
						limitFormatId: input.limitFormatId,
						blind1: input.blind1,
						blind2: input.blind2,
						blind3: input.blind3,
						blind4: input.blind4,
						ante: input.ante,
						anteType: input.anteType,
						sortOrder: input.sortOrder,
					})
					.returning({ id: sessionTournamentBlindSet.id });

				await recalculate(ctx.db, level.sessionId);
				return { id: inserted?.id };
			}

			// Cash blind set
			const session = await findLiveSession(ctx.db, input.sessionId, userId);
			assertNotDiscarded(session.status);

			const [inserted] = await ctx.db
				.insert(sessionCashBlindSet)
				.values({
					sessionId: input.sessionId,
					limitFormatId: input.limitFormatId,
					blind1: input.blind1,
					blind2: input.blind2,
					blind3: input.blind3,
					blind4: input.blind4,
					ante: input.ante,
					anteType: input.anteType,
					sortOrder: input.sortOrder,
				})
				.returning({ id: sessionCashBlindSet.id });

			await recalculate(ctx.db, input.sessionId);
			return { id: inserted?.id };
		}),

	updateBlindSet: protectedProcedure
		.input(
			z.union([
				// Tournament blind set
				z.object({
					type: z.literal("tournament"),
					id: z.number().int(),
					limitFormatId: z.number().int().min(1).optional(),
					blind1: z.number().int().min(0).optional(),
					blind2: z.number().int().min(0).optional(),
					blind3: z.number().int().min(0).nullable().optional(),
					blind4: z.number().int().min(0).nullable().optional(),
					ante: z.number().int().min(0).nullable().optional(),
					anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
					sortOrder: z.number().int().min(0).optional(),
				}),
				// Cash blind set
				z.object({
					type: z.literal("cash"),
					id: z.number().int(),
					limitFormatId: z.number().int().min(1).optional(),
					blind1: z.number().int().min(0).optional(),
					blind2: z.number().int().min(0).optional(),
					blind3: z.number().int().min(0).nullable().optional(),
					blind4: z.number().int().min(0).nullable().optional(),
					ante: z.number().int().min(0).nullable().optional(),
					anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
					sortOrder: z.number().int().min(0).optional(),
				}),
			])
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			if (input.type === "tournament") {
				await applyUpdateTournamentBlindSet(ctx.db, input.id, userId, input);
			} else {
				await applyUpdateCashBlindSet(ctx.db, input.id, userId, input);
			}

			return { id: input.id };
		}),

	removeBlindSet: protectedProcedure
		.input(
			z.union([
				z.object({ type: z.literal("tournament"), id: z.number().int() }),
				z.object({ type: z.literal("cash"), id: z.number().int() }),
			])
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			if (input.type === "tournament") {
				const [bs] = await ctx.db
					.select()
					.from(sessionTournamentBlindSet)
					.where(eq(sessionTournamentBlindSet.id, input.id));

				if (!bs) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Blind set not found",
					});
				}

				const [level] = await ctx.db
					.select()
					.from(sessionBlindLevel)
					.where(eq(sessionBlindLevel.id, bs.sessionBlindLevelId));

				if (!level) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Blind level not found",
					});
				}

				await findLiveSession(ctx.db, level.sessionId, userId);

				await ctx.db
					.delete(sessionTournamentBlindSet)
					.where(eq(sessionTournamentBlindSet.id, input.id));

				await recalculate(ctx.db, level.sessionId);
				return { success: true };
			}

			// Cash blind set
			const [bs] = await ctx.db
				.select()
				.from(sessionCashBlindSet)
				.where(eq(sessionCashBlindSet.id, input.id));

			if (!bs) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Blind set not found",
				});
			}

			await findLiveSession(ctx.db, bs.sessionId, userId);

			await ctx.db
				.delete(sessionCashBlindSet)
				.where(eq(sessionCashBlindSet.id, input.id));

			await recalculate(ctx.db, bs.sessionId);
			return { success: true };
		}),

	// ---------------------------------------------------------------------------
	// Chip purchase option CRUD
	// ---------------------------------------------------------------------------

	addChipPurchaseOption: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				name: z.string().min(1),
				cost: z.number().int().min(0),
				chips: z.number().int().min(0),
				sortOrder: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.sessionId, userId);
			assertNotDiscarded(session.status);

			const [inserted] = await ctx.db
				.insert(sessionChipPurchaseOption)
				.values({
					sessionId: input.sessionId,
					name: input.name,
					cost: input.cost,
					chips: input.chips,
					sortOrder: input.sortOrder,
				})
				.returning({ id: sessionChipPurchaseOption.id });

			await recalculate(ctx.db, input.sessionId);
			return { id: inserted?.id };
		}),

	updateChipPurchaseOption: protectedProcedure
		.input(
			z.object({
				id: z.number().int(),
				name: z.string().min(1).optional(),
				cost: z.number().int().min(0).optional(),
				chips: z.number().int().min(0).optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [opt] = await ctx.db
				.select()
				.from(sessionChipPurchaseOption)
				.where(eq(sessionChipPurchaseOption.id, input.id));

			if (!opt) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Chip purchase option not found",
				});
			}

			await findLiveSession(ctx.db, opt.sessionId, userId);

			const update: Partial<typeof sessionChipPurchaseOption.$inferInsert> = {};
			if (input.name !== undefined) {
				update.name = input.name;
			}
			if (input.cost !== undefined) {
				update.cost = input.cost;
			}
			if (input.chips !== undefined) {
				update.chips = input.chips;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			if (Object.keys(update).length > 0) {
				await ctx.db
					.update(sessionChipPurchaseOption)
					.set(update)
					.where(eq(sessionChipPurchaseOption.id, input.id));
			}

			await recalculate(ctx.db, opt.sessionId);
			return { id: input.id };
		}),

	removeChipPurchaseOption: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [opt] = await ctx.db
				.select()
				.from(sessionChipPurchaseOption)
				.where(eq(sessionChipPurchaseOption.id, input.id));

			if (!opt) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Chip purchase option not found",
				});
			}

			await findLiveSession(ctx.db, opt.sessionId, userId);

			// Guard: check if any purchase_chips events reference this option
			const events = await ctx.db
				.select({ payload: sessionEvent.payload })
				.from(sessionEvent)
				.where(
					and(
						eq(sessionEvent.sessionId, opt.sessionId),
						eq(sessionEvent.eventType, "purchase_chips")
					)
				);

			const optionIdStr = String(input.id);
			for (const evt of events) {
				try {
					const parsed = JSON.parse(evt.payload) as Record<string, unknown>;
					if (String(parsed.chipPurchaseOptionId) === optionIdStr) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"Chip purchase option is referenced by an event and cannot be removed",
						});
					}
				} catch (e) {
					if (e instanceof TRPCError) {
						throw e;
					}
				}
			}

			await ctx.db
				.delete(sessionChipPurchaseOption)
				.where(eq(sessionChipPurchaseOption.id, input.id));

			await recalculate(ctx.db, opt.sessionId);
			return { success: true };
		}),

	// ---------------------------------------------------------------------------
	// getById
	// ---------------------------------------------------------------------------

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveSession(ctx.db, input.id, userId);

			const [cashDetail] = await ctx.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			const [tournamentDetail] = await ctx.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id))
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			const blindLevels = await ctx.db
				.select()
				.from(sessionBlindLevel)
				.where(eq(sessionBlindLevel.sessionId, input.id))
				.orderBy(asc(sessionBlindLevel.sortOrder));

			const blindLevelsWithSets = await Promise.all(
				blindLevels.map(async (level) => {
					const sets = await ctx.db
						.select()
						.from(sessionTournamentBlindSet)
						.where(eq(sessionTournamentBlindSet.sessionBlindLevelId, level.id))
						.orderBy(asc(sessionTournamentBlindSet.sortOrder));
					return { ...level, blindSets: sets };
				})
			);

			const cashBlindSets = await ctx.db
				.select()
				.from(sessionCashBlindSet)
				.where(eq(sessionCashBlindSet.sessionId, input.id))
				.orderBy(asc(sessionCashBlindSet.sortOrder));

			const chipPurchaseOptions = await ctx.db
				.select()
				.from(sessionChipPurchaseOption)
				.where(eq(sessionChipPurchaseOption.sessionId, input.id))
				.orderBy(asc(sessionChipPurchaseOption.sortOrder));

			const chipPurchaseRecords = await ctx.db
				.select()
				.from(sessionChipPurchaseRecord)
				.where(eq(sessionChipPurchaseRecord.sessionId, input.id));

			const currentPlayers = await computeCurrentPlayers(ctx.db, input.id);

			return {
				...session,
				cashDetail: cashDetail ?? null,
				tournamentDetail: tournamentDetail ?? null,
				events,
				blindLevels: blindLevelsWithSets,
				cashBlindSets,
				chipPurchaseOptions,
				chipPurchaseRecords,
				currentPlayers,
			};
		}),
});
