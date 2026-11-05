import type { Database } from "@sapphire2/db";
import {
	ENTRY_KINDS,
	ENTRY_SOURCES,
	ENTRY_STATUSES,
	endStatesForKind,
	PLAY_SESSION_END_STATES,
	type PlaySessionEndState,
} from "@sapphire2/db/constants/entry";
import {
	LEDGER_ENTRY_ROLES_BY_KIND,
	LEDGER_PAYMENT_ROLES,
	LEDGER_RECEIPT_ROLES,
} from "@sapphire2/db/constants/ledger";
import { paymentsSchema } from "@sapphire2/db/constants/play-event-payloads";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { dateOnlySchema, instantSchema } from "../lib/date-only";
import { validateEntityOwnership } from "../lib/ownership";
import { tagIdsSchema } from "../lib/tag-ids";
import { cashRuleInputSchema } from "../services/cash-rules";
import {
	type EntryListFilters,
	type EntryRow,
	getEntry,
	hydrateEntries,
	selectEntryPage,
} from "../services/entry-reads";
import {
	applyMasterRule,
	overrideEntryRule,
	pushRuleToMaster,
	relinkEntry,
	restoreEntryRule,
} from "../services/entry-rule-operations";
import {
	createManualEntry,
	deleteEntry,
	MAX_ENTRY_PAYMENTS,
	MAX_ENTRY_PLAY_SESSIONS,
	updateEntry,
} from "../services/entry-writes";
import { tournamentRuleInputSchema } from "../services/tournament-rule";

const DEFAULT_ENTRY_PAGE_SIZE = 20;
const MAX_ENTRY_PAGE_SIZE = 100;
const MAX_EV_DIFF = 1_000_000_000_000;

const idSchema = z.string().min(1);
const titleSchema = z.string().max(100);
const memoSchema = z.string().max(5000);
const positiveCountSchema = z.number().int().min(1);
// NOTE(rule): api-data-integrity.md — evDiff is a signed EV difference, so a negative value is valid
const evDiffSchema = z.number().int().min(-MAX_EV_DIFF).max(MAX_EV_DIFF);

function endStateSchema(states: readonly PlaySessionEndState[]) {
	return z.enum(states as [PlaySessionEndState, ...PlaySessionEndState[]]);
}

function manualPlaySchema<
	Payments extends z.ZodType,
	EndState extends z.ZodType,
>(payments: Payments, endState: EndState) {
	return z.object({
		id: idSchema.optional(),
		localDate: dateOnlySchema,
		label: z.string().max(50).optional(),
		startedAt: instantSchema.optional(),
		endedAt: instantSchema.optional(),
		breakMinutes: z.number().int().min(0).max(100_000).optional(),
		endState,
		endStack: z.number().int().min(0).optional(),
		payments,
	});
}

const cashPayments = paymentsSchema(LEDGER_ENTRY_ROLES_BY_KIND.cash).max(
	MAX_ENTRY_PAYMENTS
);
const tournamentPayments = paymentsSchema(
	LEDGER_ENTRY_ROLES_BY_KIND.tournament
).max(MAX_ENTRY_PAYMENTS);
const anyEntryPayments = paymentsSchema([
	...LEDGER_PAYMENT_ROLES,
	...LEDGER_RECEIPT_ROLES,
]).max(MAX_ENTRY_PAYMENTS);

const cashPlaySchema = manualPlaySchema(
	cashPayments,
	endStateSchema(endStatesForKind("cash"))
);
const tournamentPlaySchema = manualPlaySchema(
	tournamentPayments,
	endStateSchema(endStatesForKind("tournament"))
);

const createSharedFields = {
	playedOn: dateOnlySchema,
	roomId: idSchema.optional(),
	assetId: idSchema.optional(),
	title: titleSchema.optional(),
	memo: memoSchema.optional(),
	tagIds: tagIdsSchema.optional(),
};

export const entryCreateCashInputSchema = z.object({
	kind: z.literal("cash"),
	...createSharedFields,
	playSessions: z
		.array(cashPlaySchema)
		.min(1)
		.max(MAX_ENTRY_PLAY_SESSIONS)
		.optional(),
	payments: cashPayments.optional(),
	ringGameId: idSchema.optional(),
	rule: cashRuleInputSchema.optional(),
	evDiff: evDiffSchema.optional(),
});

export const entryCreateTournamentInputSchema = z.object({
	kind: z.literal("tournament"),
	...createSharedFields,
	playSessions: z
		.array(tournamentPlaySchema)
		.min(1)
		.max(MAX_ENTRY_PLAY_SESSIONS)
		.optional(),
	payments: tournamentPayments.optional(),
	tournamentId: idSchema.optional(),
	rule: tournamentRuleInputSchema.optional(),
	placement: positiveCountSchema.optional(),
	totalEntries: positiveCountSchema.optional(),
	beforeDeadline: z.boolean().default(false),
});

export const entryCreateInputSchema = z.discriminatedUnion("kind", [
	entryCreateCashInputSchema,
	entryCreateTournamentInputSchema,
]);

export const entryUpdateInputSchema = z.object({
	id: idSchema,
	playedOn: dateOnlySchema.optional(),
	playSessions: z
		.array(
			manualPlaySchema(
				anyEntryPayments,
				endStateSchema(PLAY_SESSION_END_STATES)
			)
		)
		.min(1)
		.max(MAX_ENTRY_PLAY_SESSIONS)
		.optional(),
	payments: anyEntryPayments.optional(),
	roomId: idSchema.nullable().optional(),
	assetId: idSchema.nullable().optional(),
	title: titleSchema.nullable().optional(),
	memo: memoSchema.nullable().optional(),
	tagIds: tagIdsSchema.optional(),
	evDiff: evDiffSchema.nullable().optional(),
	placement: positiveCountSchema.nullable().optional(),
	totalEntries: positiveCountSchema.nullable().optional(),
	beforeDeadline: z.boolean().optional(),
});

export const entryIdInputSchema = z.object({ id: idSchema });

export const entryOverrideRuleInputSchema = z.discriminatedUnion("kind", [
	z.object({
		id: idSchema,
		kind: z.literal("cash"),
		rule: cashRuleInputSchema,
	}),
	z.object({
		id: idSchema,
		kind: z.literal("tournament"),
		rule: tournamentRuleInputSchema,
	}),
]);

export const entryRelinkInputSchema = z.union([
	z.object({
		id: idSchema,
		ringGameId: idSchema.nullable(),
		keepRule: z.boolean(),
	}),
	z.object({
		id: idSchema,
		tournamentId: idSchema.nullable(),
		keepRule: z.boolean(),
	}),
]);

export const entryRestoreRuleInputSchema = z.object({
	id: idSchema,
	masterId: idSchema.nullable(),
	ruleVersionId: idSchema,
	masterRuleVersionId: idSchema.optional(),
});

export const entryListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z
			.number()
			.int()
			.min(1)
			.max(MAX_ENTRY_PAGE_SIZE)
			.default(DEFAULT_ENTRY_PAGE_SIZE),
		kind: z.enum(ENTRY_KINDS).optional(),
		status: z.enum(ENTRY_STATUSES).optional(),
		roomId: idSchema.optional(),
		assetId: idSchema.optional(),
		dateFrom: dateOnlySchema.optional(),
		dateTo: dateOnlySchema.optional(),
	})
	.refine(
		(input) =>
			input.dateFrom === undefined ||
			input.dateTo === undefined ||
			input.dateFrom <= input.dateTo,
		{ message: "dateFrom must not be after dateTo", path: ["dateTo"] }
	);

const entryCursorSchema = z.object({
	scope: z.object({
		userId: z.string(),
		source: z.enum(ENTRY_SOURCES).nullable(),
		kind: z.enum(ENTRY_KINDS).nullable(),
		status: z.enum(ENTRY_STATUSES).nullable(),
		roomId: z.string().nullable(),
		assetId: z.string().nullable(),
		dateFrom: z.string().nullable(),
		dateTo: z.string().nullable(),
	}),
	playedOn: z.string(),
	id: z.string(),
});

function cursorScope(userId: string, filters: EntryListFilters) {
	return {
		userId,
		source: filters.source ?? null,
		kind: filters.kind ?? null,
		status: filters.status ?? null,
		roomId: filters.roomId ?? null,
		assetId: filters.assetId ?? null,
		dateFrom: filters.dateFrom ?? null,
		dateTo: filters.dateTo ?? null,
	};
}

export async function listEntryPage<Item>(
	db: Database,
	userId: string,
	input: z.infer<typeof entryListInputSchema> &
		Pick<EntryListFilters, "source">,
	hydrate: (rows: EntryRow[]) => Promise<Item[]>
): Promise<{ items: Item[]; nextCursor: string | null }> {
	const { cursor: rawCursor, limit, ...filters } = input;
	const scope = cursorScope(userId, filters);
	const cursor =
		rawCursor === undefined
			? undefined
			: decodeCursor(rawCursor, entryCursorSchema);
	if (cursor && JSON.stringify(cursor.scope) !== JSON.stringify(scope)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This cursor belongs to another entry list",
		});
	}
	if (filters.roomId) {
		await validateEntityOwnership(db, "room", filters.roomId, userId);
	}
	if (filters.assetId) {
		await validateEntityOwnership(db, "asset", filters.assetId, userId);
	}
	const rows = await selectEntryPage(db, userId, filters, {
		after: cursor && { playedOn: cursor.playedOn, id: cursor.id },
		limit: limit + 1,
	});
	const page = rows.slice(0, limit);
	const boundary = rows.length > limit ? page.at(-1) : undefined;
	return {
		items: await hydrate(page),
		nextCursor: boundary
			? encodeCursor({
					scope,
					playedOn: boundary.playedOn,
					id: boundary.id,
				})
			: null,
	};
}

export const entryRouter = router({
	list: protectedProcedure
		.input(entryListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			return await listEntryPage(ctx.db, userId, input, (rows) =>
				hydrateEntries(ctx.db, userId, rows)
			);
		}),

	getById: protectedProcedure
		.input(entryIdInputSchema)
		.query(
			async ({ ctx, input }) =>
				await getEntry(ctx.db, ctx.session.user.id, input.id)
		),

	create: protectedProcedure
		.input(entryCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = await createManualEntry(ctx.db, userId, input, new Date());
			return await getEntry(ctx.db, userId, id);
		}),

	update: protectedProcedure
		.input(entryUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await updateEntry(ctx.db, userId, input, new Date());
			return await getEntry(ctx.db, userId, input.id);
		}),

	delete: protectedProcedure
		.input(entryIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			await deleteEntry(ctx.db, ctx.session.user.id, input.id);
			return { success: true as const };
		}),

	overrideRule: protectedProcedure
		.input(entryOverrideRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await overrideEntryRule(ctx.db, userId, input, {
				live: false,
				now: new Date(),
			});
			return await getEntry(ctx.db, userId, input.id);
		}),

	applyMasterRule: protectedProcedure
		.input(entryIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await applyMasterRule(ctx.db, userId, input.id, {
				live: false,
				now: new Date(),
			});
			return await getEntry(ctx.db, userId, input.id);
		}),

	pushRuleToMaster: protectedProcedure
		.input(entryIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await pushRuleToMaster(ctx.db, userId, input.id, {
				live: false,
				now: new Date(),
			});
			return await getEntry(ctx.db, userId, input.id);
		}),

	relink: protectedProcedure
		.input(entryRelinkInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await relinkEntry(ctx.db, userId, input, {
				live: false,
				now: new Date(),
			});
			return await getEntry(ctx.db, userId, input.id);
		}),

	restoreRule: protectedProcedure
		.input(entryRestoreRuleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await restoreEntryRule(ctx.db, userId, input, {
				live: false,
				now: new Date(),
			});
			return await getEntry(ctx.db, userId, input.id);
		}),
});
