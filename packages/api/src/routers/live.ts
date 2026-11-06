import {
	END_STATES_REQUIRING_STACK,
	SETTLING_END_STATES,
} from "@sapphire2/db/constants/entry";
import { paymentsSchema } from "@sapphire2/db/constants/play-event-payloads";
import { dateOnlySchema } from "@sapphire2/db/schemas/date-only";
import { idSchema } from "@sapphire2/db/schemas/id";
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

const memoSchema = z.string().max(5000);
const positiveCountSchema = z.number().int().min(1);

const startSharedFields = {
	assetId: idSchema.optional(),
	label: z.string().max(50).optional(),
	localDate: dateOnlySchema.optional(),
	memo: memoSchema.optional(),
	roomId: idSchema.optional(),
	startedAt: instantSchema.optional(),
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
		initialStack: z.number().int().min(0).optional(),
		payments: paymentsSchema(["buy_in", "fee"]).max(MAX_ENTRY_PAYMENTS),
		rule: tournamentRuleInputSchema.optional(),
		startLevel: positiveCountSchema.optional(),
		timerStartedAt: instantSchema.optional(),
		tournamentId: idSchema.optional(),
	}),
]);

export const liveCompleteInputSchema = z.object({
	beforeDeadline: z.boolean().optional(),
	endState: z.enum(SETTLING_END_STATES),
	id: idSchema,
	occurredAt: instantSchema.optional(),
	payments: paymentsSchema(["cash_out", "prize", "bounty"]).max(
		MAX_ENTRY_PAYMENTS
	),
	placement: positiveCountSchema.optional(),
	totalEntries: positiveCountSchema.optional(),
});

export const liveEndPlayInputSchema = z.object({
	endState: z.enum(END_STATES_REQUIRING_STACK),
	id: idSchema,
	occurredAt: instantSchema.optional(),
	stackAmount: z.number().int().min(0),
});

export const liveStartNextPlayInputSchema = z.object({
	id: idSchema,
	label: z.string().max(50).optional(),
	localDate: dateOnlySchema.optional(),
	payments: paymentsSchema(["reentry", "fee"])
		.max(MAX_ENTRY_PAYMENTS)
		.optional(),
	startedAt: instantSchema.optional(),
	startLevel: positiveCountSchema.optional(),
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
	applyMasterRule: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await applyMasterRule(ctx.db, userId, input.id, liveRuleContext());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	complete: protectedProcedure
		.input(liveCompleteInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await completeLiveEntry(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	create: protectedProcedure
		.input(liveCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = await startLiveEntry(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, id);
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
					plan: () =>
						planRingGameCreate(ctx.db, {
							id: masterId,
							input: master,
							now: context.now,
							userId,
						}),
					tableSize: master.rule.tableSize ?? null,
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
					plan: () => planTournamentCreate(ctx.db, userId, masterId, master),
					tableSize: master.rule.tableSize ?? null,
				},
				liveRuleContext()
			);
			return await getLiveEntry(ctx.db, userId, entryId);
		}),

	discard: protectedProcedure
		.input(liveIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			await discardLiveEntry(ctx.db, ctx.session.user.id, input.id);
			return { success: true as const };
		}),

	endPlay: protectedProcedure
		.input(liveEndPlayInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await endLivePlay(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),

	getById: protectedProcedure
		.input(liveIdInputSchema)
		.query(
			async ({ ctx, input }) =>
				await getLiveEntryDetail(ctx.db, ctx.session.user.id, input.id)
		),
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

	overrideRule: protectedProcedure
		.input(entryOverrideRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await overrideEntryRule(ctx.db, userId, input, liveRuleContext());
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

	update: protectedProcedure
		.input(
			z.object({
				assetId: idSchema.nullable().optional(),
				id: idSchema,
				memo: memoSchema.nullable().optional(),
				roomId: idSchema.nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await updateLiveEntry(ctx.db, userId, input, new Date());
			return await getLiveEntry(ctx.db, userId, input.id);
		}),
});
