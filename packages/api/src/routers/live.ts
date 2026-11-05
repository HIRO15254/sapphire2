import { END_STATES_REQUIRING_STACK } from "@sapphire2/db/constants/entry";
import { paymentsSchema } from "@sapphire2/db/constants/play-event-payloads";
import { dateOnlySchema } from "@sapphire2/db/schemas/date-only";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { instantSchema } from "../lib/instant";
import { cashRuleInputSchema } from "../services/cash-rules";
import {
	applyMasterRule,
	assignCreatedMaster,
	overrideEntryRule,
	pushRuleToMaster,
	type RuleOperationContext,
	relinkEntry,
	restoreEntryRule,
} from "../services/entry-rule-operations";
import { MAX_ENTRY_PAYMENTS } from "../services/entry-writes";
import {
	completeLiveEntry,
	discardLiveEntry,
	endLivePlay,
	getLiveEntry,
	getLiveEntryDetail,
	hydrateLiveEntries,
	startLiveEntry,
	startNextLivePlay,
	undoLiveEndPlay,
	undoLiveStartNextPlay,
	updateLiveEntry,
} from "../services/live-entry";
import { tournamentRuleInputSchema } from "../services/tournament-rule";
import {
	entryListInputSchema,
	entryOverrideRuleInputSchema,
	entryRelinkInputSchema,
	entryRestoreRuleInputSchema,
	listEntryPage,
} from "./entry";
import { planRingGameCreate, ringGameCreateInputSchema } from "./ring-game";
import {
	planTournamentCreate,
	tournamentCreateWithLevelsInputSchema,
} from "./tournament";

const idSchema = z.string().min(1);
const memoSchema = z.string().max(5000);
const positiveCountSchema = z.number().int().min(1);

const startSharedFields = {
	roomId: idSchema.optional(),
	assetId: idSchema.optional(),
	memo: memoSchema.optional(),
	startedAt: instantSchema.optional(),
	localDate: dateOnlySchema.optional(),
	label: z.string().max(50).optional(),
};

export const liveCreateInputSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("cash"),
		...startSharedFields,
		payments: paymentsSchema(["buy_in"]).max(MAX_ENTRY_PAYMENTS),
		ringGameId: idSchema.optional(),
		rule: cashRuleInputSchema.optional(),
	}),
	z.object({
		kind: z.literal("tournament"),
		...startSharedFields,
		payments: paymentsSchema(["buy_in", "fee"]).max(MAX_ENTRY_PAYMENTS),
		tournamentId: idSchema.optional(),
		rule: tournamentRuleInputSchema.optional(),
		initialStack: z.number().int().min(0).optional(),
		timerStartedAt: instantSchema.optional(),
		startLevel: positiveCountSchema.optional(),
	}),
]);

export const liveCompleteInputSchema = z.object({
	id: idSchema,
	occurredAt: instantSchema.optional(),
	endState: z.enum(["cashed_out", "busted", "finished"]),
	payments: paymentsSchema(["cash_out", "prize", "bounty"]).max(
		MAX_ENTRY_PAYMENTS
	),
	beforeDeadline: z.boolean().optional(),
	placement: positiveCountSchema.optional(),
	totalEntries: positiveCountSchema.optional(),
});

export const liveEndPlayInputSchema = z.object({
	id: idSchema,
	occurredAt: instantSchema.optional(),
	endState: z.enum(END_STATES_REQUIRING_STACK),
	stackAmount: z.number().int().min(0),
});

export const liveStartNextPlayInputSchema = z.object({
	id: idSchema,
	startedAt: instantSchema.optional(),
	localDate: dateOnlySchema.optional(),
	label: z.string().max(50).optional(),
	startLevel: positiveCountSchema.optional(),
	payments: paymentsSchema(["reentry", "fee"])
		.max(MAX_ENTRY_PAYMENTS)
		.optional(),
});

const liveIdInputSchema = z.object({ id: idSchema });

export const liveCreateAndAssignRingGameInputSchema =
	ringGameCreateInputSchema.extend({ entryId: idSchema });

export const liveCreateAndAssignTournamentInputSchema =
	tournamentCreateWithLevelsInputSchema.extend({ entryId: idSchema });

function liveRuleContext(): RuleOperationContext {
	return { live: true, now: new Date() };
}

export const liveRouter = router({
	list: protectedProcedure
		.input(entryListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			return await listEntryPage(
				ctx.db,
				userId,
				{ ...input, source: "live" },
				(rows) => hydrateLiveEntries(ctx.db, userId, rows)
			);
		}),

	getById: protectedProcedure
		.input(liveIdInputSchema)
		.query(
			async ({ ctx, input }) =>
				await getLiveEntryDetail(ctx.db, ctx.session.user.id, input.id)
		),

	create: protectedProcedure
		.input(liveCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = await startLiveEntry(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, id);
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: idSchema,
				memo: memoSchema.nullable().optional(),
				roomId: idSchema.nullable().optional(),
				assetId: idSchema.nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await updateLiveEntry(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	complete: protectedProcedure
		.input(liveCompleteInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await completeLiveEntry(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	endPlay: protectedProcedure
		.input(liveEndPlayInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await endLivePlay(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	startNextPlay: protectedProcedure
		.input(liveStartNextPlayInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await startNextLivePlay(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	undoEndPlay: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await undoLiveEndPlay(ctx.db, userId, input.id, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	undoStartNextPlay: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await undoLiveStartNextPlay(ctx.db, userId, input.id, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	discard: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			await discardLiveEntry(ctx.db, ctx.session.user.id, input.id);
			return { success: true as const };
		}),

	createAndAssignRingGame: protectedProcedure
		.input(liveCreateAndAssignRingGameInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { entryId, ...master } = input;
			const masterId = crypto.randomUUID();
			const context = liveRuleContext();
			await assignCreatedMaster(
				ctx.db,
				userId,
				{
					entryId,
					kind: "cash",
					masterId,
					tableSize: master.rule.tableSize ?? null,
					plan: () =>
						planRingGameCreate(ctx.db, {
							id: masterId,
							input: master,
							userId,
							now: context.now,
						}),
				},
				context
			);
			return await getLiveEntry(ctx.db, userId, entryId);
		}),

	createAndAssignTournament: protectedProcedure
		.input(liveCreateAndAssignTournamentInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { entryId, ...master } = input;
			const masterId = crypto.randomUUID();
			await assignCreatedMaster(
				ctx.db,
				userId,
				{
					entryId,
					kind: "tournament",
					masterId,
					tableSize: master.rule.tableSize ?? null,
					plan: () => planTournamentCreate(ctx.db, userId, masterId, master),
				},
				liveRuleContext()
			);
			return await getLiveEntry(ctx.db, userId, entryId);
		}),

	overrideRule: protectedProcedure
		.input(entryOverrideRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await overrideEntryRule(ctx.db, userId, input, liveRuleContext());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	applyMasterRule: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await applyMasterRule(ctx.db, userId, input.id, liveRuleContext());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	pushRuleToMaster: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await pushRuleToMaster(ctx.db, userId, input.id, liveRuleContext());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	relink: protectedProcedure
		.input(entryRelinkInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await relinkEntry(ctx.db, userId, input, liveRuleContext());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	restoreRule: protectedProcedure
		.input(entryRestoreRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await restoreEntryRule(ctx.db, userId, input, liveRuleContext());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),
});
