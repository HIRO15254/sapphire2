import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import {
	cashSessionEndPayload,
	MAX_SEAT_POSITION,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";
import { entry, entryCash, playSession } from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import type { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { mixGamesSchema } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { runBatch } from "../lib/batch";
import {
	ACTIVE_SESSION_CONFLICT_MESSAGE,
	runUnfinishedLiveSessionWrite,
} from "../lib/db-errors";
import {
	findLiveCashEntrySession,
	getPlayEventMap,
	type LegacySessionEventRow,
	listEntryPlayEvents,
	listLiveCashEntryRows,
} from "../services/entry-live-reads";
import {
	applyEntryEventChange,
	buildLiveEntryStartStatements,
	updateEntryHeroSeat,
} from "../services/entry-live-writes";
import {
	buildEntryDeleteStatements,
	legacySessionDateSql,
} from "../services/entry-session";
import {
	computeCashGamePLFromEvents,
	computeCashGameSummaryFromEvents,
	computeHeroSeatPositionFromEvents,
} from "../services/live-session-pl";
import {
	assertHandTrackingEditable,
	buildHandTrackingStatements,
	buildLiveSessionUpdateData,
	dealerSeatSchema,
	handCountSchema,
} from "../utils/live-session-update";
import { assertSeatPositionFitsTableSize } from "../utils/seat-position";
import { floorToMinute } from "../utils/session-event-time";
import {
	buildRingGameCreateStatement,
	ringGameCreateInputSchema,
} from "./ring-game";
import {
	cashMixFlatFieldClearPatch,
	encodeSessionCursor,
	reconcileCashRuleSelection,
	resolveCashRuleSnapshot,
	sessionKeysetCondition,
	validateEntityOwnership,
	validateLiveLinkOwnership,
} from "./session";

const DEFAULT_LIMIT = 20;
const nullableNonnegativeSafeIntegerSchema = z
	.number()
	.int()
	.min(0)
	.max(Number.MAX_SAFE_INTEGER)
	.nullable()
	.optional();
const nullableTableSizeSchema = z
	.number()
	.int()
	.min(2)
	.max(10)
	.nullable()
	.optional();

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

const LIVE_CASH_SESSION_FORBIDDEN_MESSAGE =
	"You do not own this live cash game session";

const cashDetailColumns = {
	sessionId: sessionCashDetail.sessionId,
	buyIn: sessionCashDetail.buyIn,
	cashOut: sessionCashDetail.cashOut,
	chipRemoveTotal: sessionCashDetail.chipRemoveTotal,
	ruleName: sessionCashDetail.ruleName,
	variant: sessionCashDetail.variant,
	mixGames: sessionCashDetail.mixGames,
	blind1: sessionCashDetail.blind1,
	blind2: sessionCashDetail.blind2,
	blind3: sessionCashDetail.blind3,
	ante: sessionCashDetail.ante,
	anteType: sessionCashDetail.anteType,
	minBuyIn: sessionCashDetail.minBuyIn,
	maxBuyIn: sessionCashDetail.maxBuyIn,
	tableSize: sessionCashDetail.tableSize,
	houseRules: sessionCashDetail.houseRules,
};

const liveCashGameSessionListInput = z.object({
	status: z.enum(["active", "paused", "completed"]).optional(),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
});

type LiveSessionEventMap = Map<
	string,
	{ eventType: string; payload: string }[]
>;

async function assembleLiveCashListPage<
	Row extends { id: string; sessionDate: Date; startedAt: Date | null },
>(
	rows: Row[],
	limit: number,
	loadEvents: (ids: string[]) => Promise<LiveSessionEventMap>
) {
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;
	const last = items.at(-1);
	const nextCursor = hasMore && last ? encodeSessionCursor(last) : undefined;

	const eventMap = await loadEvents(items.map((item) => item.id));

	const enrichedItems = items.map((item) => {
		const events = eventMap.get(item.id) ?? [];
		const eventCount = events.length;
		let latestStackAmount: number | null = null;

		for (const event of [...events].reverse()) {
			if (event.eventType === "update_stack") {
				const parsed = updateStackPayload.safeParse(JSON.parse(event.payload));
				if (parsed.success) {
					latestStackAmount = parsed.data.stackAmount;
					break;
				}
			}
		}

		return { ...item, eventCount, latestStackAmount };
	});

	return { items: enrichedItems, nextCursor };
}

function assembleLiveCashSession(
	session: typeof gameSession.$inferSelect,
	ringGameId: string | null,
	cashDetail:
		| Omit<typeof sessionCashDetail.$inferSelect, "ringGameId" | "evCashOut">
		| undefined,
	events: LegacySessionEventRow[]
) {
	const mappedEvents = events.map((e) => ({
		eventType: e.eventType,
		payload: e.payload,
	}));
	const s = computeCashGameSummaryFromEvents(mappedEvents);
	const pl = computeCashGamePLFromEvents(mappedEvents);

	const summary = {
		totalBuyIn: s.totalBuyIn,
		cashOut: s.cashOut,
		chipRemoveTotal: pl.chipRemoveTotal,
		profitLoss: pl.profitLoss,
		evCashOut: pl.evCashOut,
		evDiff: pl.evDiff,
		addonCount: s.addonCount,
		maxStack: s.maxStack,
		minStack: s.minStack,
		currentStack: s.currentStack,
	};

	const heroSeatPosition = computeHeroSeatPositionFromEvents(mappedEvents);

	return {
		...session,
		ringGameId,
		heroSeatPosition,
		events,
		summary,
		ruleName: cashDetail?.ruleName ?? null,
		variant: cashDetail?.variant ?? null,
		mixGames: cashDetail?.mixGames ?? null,
		blind1: cashDetail?.blind1 ?? null,
		blind2: cashDetail?.blind2 ?? null,
		blind3: cashDetail?.blind3 ?? null,
		ante: cashDetail?.ante ?? null,
		anteType: cashDetail?.anteType ?? null,
		minBuyIn: cashDetail?.minBuyIn ?? null,
		maxBuyIn: cashDetail?.maxBuyIn ?? null,
		tableSize: cashDetail?.tableSize ?? null,
		houseRules: cashDetail?.houseRules ?? null,
	};
}

async function listLiveCashGameSessions(
	db: DbInstance,
	userId: string,
	input: z.output<typeof liveCashGameSessionListInput>
) {
	const rows = await listLiveCashEntryRows(db, userId, {
		status: input.status,
		keyset: sessionKeysetCondition(
			input.cursor,
			legacySessionDateSql(),
			entry.id
		),
		limit: input.limit + 1,
	});
	return assembleLiveCashListPage(rows, input.limit, (ids) =>
		getPlayEventMap(db, userId, ids)
	);
}

async function getLiveCashGameSession(
	db: DbInstance,
	userId: string,
	input: { id: string }
) {
	const found = await findLiveCashEntrySession(db, userId, input.id);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: LIVE_CASH_SESSION_FORBIDDEN_MESSAGE,
		});
	}
	const [cashDetail] = await db
		.select(cashDetailColumns)
		.from(sessionCashDetail)
		.where(eq(sessionCashDetail.sessionId, input.id));
	const events = await listEntryPlayEvents(db, userId, input.id);
	return assembleLiveCashSession(
		found.session,
		found.ringGameId,
		cashDetail,
		events
	);
}

async function ringGameSnapshotPatch(
	db: DbInstance,
	ringGameId: string,
	keepSnapshot: boolean
): Promise<Partial<typeof sessionCashDetail.$inferInsert>> {
	if (keepSnapshot) {
		return {};
	}
	const snapshot = await resolveCashRuleSnapshot(db, { ringGameId });
	return {
		ante: snapshot.ante,
		anteType: snapshot.anteType,
		blind1: snapshot.blind1,
		blind2: snapshot.blind2,
		blind3: snapshot.blind3,
		houseRules: snapshot.houseRules,
		maxBuyIn: snapshot.maxBuyIn,
		minBuyIn: snapshot.minBuyIn,
		mixGames: snapshot.mixGames,
		ruleName: snapshot.ruleName,
		tableSize: snapshot.tableSize,
		variant: snapshot.variant,
	};
}

export async function persistCashSessionReopenEvents(
	db: DbInstance,
	params: {
		cashOutAmount: number;
		flooredEndOccurredAt: Date;
		flooredNow: Date;
		now: Date;
		sessionEndEventId: string;
		sessionId: string;
		userId: string;
	}
): Promise<void> {
	await applyEntryEventChange(
		db,
		params.userId,
		params.sessionId,
		[
			{ op: "delete", id: params.sessionEndEventId },
			{
				op: "append",
				events: [
					{
						type: "update_stack",
						occurredAt: params.flooredEndOccurredAt,
						payload: { stackAmount: params.cashOutAmount },
					},
					{
						type: "session_pause",
						occurredAt: params.flooredEndOccurredAt,
						payload: {},
					},
					{
						type: "session_resume",
						occurredAt: params.flooredNow,
						payload: {},
					},
				],
			},
		],
		params.now
	);
}

async function findLiveCashGameSession(
	db: DbInstance,
	id: string,
	userId: string
) {
	const found = await findLiveCashEntrySession(db, userId, id);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: LIVE_CASH_SESSION_FORBIDDEN_MESSAGE,
		});
	}

	return found.session;
}

async function resolveRingGameAssignment(
	db: DbInstance,
	ringGameId: string,
	userId: string,
	currentRoomId: string | null,
	currentCurrencyId: string | null
): Promise<{
	ringGameId: string;
	roomId?: string;
	currencyId?: string;
}> {
	const [foundRingGame] = await db
		.select()
		.from(ringGame)
		.where(and(eq(ringGame.id, ringGameId), eq(ringGame.userId, userId)));

	if (!foundRingGame) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}

	if (foundRingGame.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}

	if (
		currentRoomId &&
		foundRingGame.roomId &&
		currentRoomId !== foundRingGame.roomId
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ring game belongs to a different room than the session",
		});
	}

	const patch: { ringGameId: string; roomId?: string; currencyId?: string } = {
		ringGameId,
	};
	if (!currentRoomId && foundRingGame.roomId) {
		patch.roomId = foundRingGame.roomId;
	}
	if (!currentCurrencyId && foundRingGame.currencyId) {
		patch.currencyId = foundRingGame.currencyId;
	}
	return patch;
}

export const liveCashGameSessionRouter = router({
	list: protectedProcedure
		.input(liveCashGameSessionListInput)
		.query(({ ctx, input }) =>
			listLiveCashGameSessions(ctx.db, ctx.session.user.id, input)
		),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) =>
			getLiveCashGameSession(ctx.db, ctx.session.user.id, input)
		),

	create: protectedProcedure
		.input(
			z.object({
				roomId: z.string().min(1).optional(),
				ringGameId: z.string().min(1).optional(),
				currencyId: z.string().min(1).optional(),
				memo: z.string().optional(),
				initialBuyIn: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const now = new Date();

			await validateLiveLinkOwnership(ctx.db, input, userId);
			if (input.ringGameId) {
				await validateEntityOwnership(
					ctx.db,
					"ringGame",
					input.ringGameId,
					userId
				);
			}

			const anyActive = await ctx.db
				.select({ id: playSession.id })
				.from(playSession)
				.where(
					and(eq(playSession.userId, userId), ne(playSession.status, "ended"))
				)
				.limit(1);

			if (anyActive.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: ACTIVE_SESSION_CONFLICT_MESSAGE,
				});
			}

			if (input.ringGameId) {
				const [foundRingGame] = await ctx.db
					.select({
						minBuyIn: ringGame.minBuyIn,
						maxBuyIn: ringGame.maxBuyIn,
					})
					.from(ringGame)
					.where(
						and(eq(ringGame.id, input.ringGameId), eq(ringGame.userId, userId))
					);

				if (foundRingGame) {
					if (
						foundRingGame.minBuyIn !== null &&
						input.initialBuyIn < foundRingGame.minBuyIn
					) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Initial buy-in must be at least ${foundRingGame.minBuyIn}`,
						});
					}
					if (
						foundRingGame.maxBuyIn !== null &&
						input.initialBuyIn > foundRingGame.maxBuyIn
					) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Initial buy-in must be at most ${foundRingGame.maxBuyIn}`,
						});
					}
				}
			}

			const id = crypto.randomUUID();

			const snapshot = await resolveCashRuleSnapshot(ctx.db, {
				ringGameId: input.ringGameId,
			});
			await runUnfinishedLiveSessionWrite(() =>
				runBatch(ctx.db, [
					...buildLiveEntryStartStatements(ctx.db, {
						id,
						userId,
						now,
						detail: { kind: "cash", ringGameId: input.ringGameId ?? null },
						assetId: input.currencyId ?? null,
						roomId: input.roomId ?? null,
						memo: input.memo ?? null,
						title: null,
						localDate: new Date(now.getTime() + 9 * 60 * 60 * 1000)
							.toISOString()
							.slice(0, 10),
						startEvent: {
							occurredAt: floorToMinute(now),
							payload: { buyInAmount: input.initialBuyIn },
						},
					}),
					ctx.db.insert(sessionCashDetail).values({
						sessionId: id,
						ruleName: input.ringGameId ? snapshot.ruleName : "Cash Game",
						variant: snapshot.variant,
						mixGames: snapshot.mixGames,
						blind1: snapshot.blind1,
						blind2: snapshot.blind2,
						blind3: snapshot.blind3,
						ante: snapshot.ante,
						anteType: snapshot.anteType,
						minBuyIn: snapshot.minBuyIn,
						maxBuyIn: snapshot.maxBuyIn,
						tableSize: snapshot.tableSize,
						houseRules: snapshot.houseRules,
					}),
				])
			);

			return { id };
		}),

	createAndAssignRingGame: protectedProcedure
		.input(ringGameCreateInputSchema.safeExtend({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await findLiveCashGameSession(
				ctx.db,
				input.sessionId,
				userId
			);
			await validateLiveLinkOwnership(ctx.db, input, userId);
			if (existing.roomId && existing.roomId !== input.roomId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Ring game belongs to a different room than the session",
				});
			}

			const selection = await reconcileCashRuleSelection(
				ctx.db,
				userId,
				undefined,
				input
			);
			const frozenFlatFields = cashMixFlatFieldClearPatch(selection.mixGames);
			const now = new Date();
			const ringGameId = crypto.randomUUID();

			const sessionUpdate: Partial<typeof entry.$inferInsert> = {
				updatedAt: now,
			};
			if (!existing.roomId) {
				sessionUpdate.roomId = input.roomId;
			}
			if (!existing.currencyId && input.currencyId) {
				sessionUpdate.assetId = input.currencyId;
			}

			const snapshot = {
				ruleName: input.name,
				variant: selection.variant,
				mixGames: selection.mixGames,
				blind1: input.blind1 ?? null,
				blind2: input.blind2 ?? null,
				blind3: input.blind3 ?? null,
				ante: input.ante ?? null,
				anteType: input.anteType ?? null,
				minBuyIn: input.minBuyIn ?? null,
				maxBuyIn: input.maxBuyIn ?? null,
				tableSize: input.tableSize ?? null,
				houseRules: input.houseRules ?? null,
				...frozenFlatFields,
			};
			const detailStatement = ctx.db
				.insert(sessionCashDetail)
				.values({
					sessionId: input.sessionId,
					...snapshot,
				})
				.onConflictDoUpdate({
					target: sessionCashDetail.sessionId,
					set: snapshot,
				});
			const statements: [BatchStatement, ...BatchStatement[]] = [
				buildRingGameCreateStatement(ctx.db, {
					id: ringGameId,
					input,
					userId,
					variant: selection.variant,
					mixGames: selection.mixGames,
					now,
				}),
				ctx.db
					.update(entry)
					.set(sessionUpdate)
					.where(and(eq(entry.id, input.sessionId), eq(entry.userId, userId))),
				ctx.db
					.update(entryCash)
					.set({ ringGameId })
					.where(
						and(
							eq(entryCash.entryId, input.sessionId),
							eq(entryCash.userId, userId)
						)
					),
				detailStatement,
			];
			await applyEntryEventChange(
				ctx.db,
				userId,
				input.sessionId,
				[],
				now,
				statements,
				{
					assetId: sessionUpdate.assetId,
				}
			);

			return { sessionId: input.sessionId, ringGameId };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				memo: z.string().nullable().optional(),
				roomId: z.string().min(1).nullable().optional(),
				currencyId: z.string().min(1).nullable().optional(),
				ringGameId: z.string().min(1).nullable().optional(),
				keepSnapshot: z.boolean().optional(),
				handCount: handCountSchema,
				dealerSeat: dealerSeatSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await findLiveCashGameSession(ctx.db, input.id, userId);
			await assertHandTrackingEditable(ctx.db, userId, input.id, input);

			const [existingCashDetail] = await ctx.db
				.select(cashDetailColumns)
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			await validateLiveLinkOwnership(ctx.db, input, userId);

			const updateData = buildLiveSessionUpdateData(input);

			const cashDetailUpdate: Partial<typeof sessionCashDetail.$inferInsert> =
				{};
			const entryCashUpdate: Partial<typeof entryCash.$inferInsert> = {};

			if (input.ringGameId === null) {
				entryCashUpdate.ringGameId = null;
			} else if (input.ringGameId !== undefined) {
				await validateEntityOwnership(
					ctx.db,
					"ringGame",
					input.ringGameId,
					userId
				);
				const resolvedRoomId =
					updateData.roomId === undefined ? existing.roomId : updateData.roomId;
				const resolvedCurrencyId =
					updateData.assetId === undefined
						? existing.currencyId
						: updateData.assetId;
				const patch = await resolveRingGameAssignment(
					ctx.db,
					input.ringGameId,
					userId,
					resolvedRoomId,
					resolvedCurrencyId
				);
				entryCashUpdate.ringGameId = patch.ringGameId;
				if (patch.roomId) {
					updateData.roomId = patch.roomId;
				}
				if (patch.currencyId) {
					updateData.assetId = patch.currencyId;
				}

				Object.assign(
					cashDetailUpdate,
					await ringGameSnapshotPatch(
						ctx.db,
						input.ringGameId,
						input.keepSnapshot === true
					)
				);
			}

			const statements: BatchStatement[] = [
				ctx.db
					.update(entry)
					.set(updateData)
					.where(and(eq(entry.id, input.id), eq(entry.userId, userId))),
				...buildHandTrackingStatements(ctx.db, userId, input.id, input),
			];
			if (Object.keys(entryCashUpdate).length > 0) {
				statements.push(
					ctx.db
						.update(entryCash)
						.set(entryCashUpdate)
						.where(
							and(eq(entryCash.entryId, input.id), eq(entryCash.userId, userId))
						)
				);
			}
			if (Object.keys(cashDetailUpdate).length > 0) {
				statements.push(
					existingCashDetail
						? ctx.db
								.update(sessionCashDetail)
								.set(cashDetailUpdate)
								.where(eq(sessionCashDetail.sessionId, input.id))
						: ctx.db.insert(sessionCashDetail).values({
								sessionId: input.id,
								variant: DEFAULT_VARIANT_LABEL,
								...cashDetailUpdate,
							})
				);
			}
			await applyEntryEventChange(
				ctx.db,
				userId,
				input.id,
				[],
				new Date(),
				statements,
				{
					assetId: updateData.assetId,
				}
			);
			const updated = await findLiveCashEntrySession(ctx.db, userId, input.id);
			return { ...updated?.session, ringGameId: updated?.ringGameId ?? null };
		}),

	updateSnapshot: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				ruleName: z.string().min(1).optional(),
				variant: z.string().optional(),
				mixGames: mixGamesSchema.nullish(),
				blind1: nullableNonnegativeSafeIntegerSchema,
				blind2: nullableNonnegativeSafeIntegerSchema,
				blind3: nullableNonnegativeSafeIntegerSchema,
				ante: nullableNonnegativeSafeIntegerSchema,
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				minBuyIn: nullableNonnegativeSafeIntegerSchema,
				maxBuyIn: nullableNonnegativeSafeIntegerSchema,
				tableSize: nullableTableSizeSchema,
				houseRules: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveCashGameSession(ctx.db, input.id, userId);
			const [existingDetail] = await ctx.db
				.select(cashDetailColumns)
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));
			const selection = await reconcileCashRuleSelection(
				ctx.db,
				userId,
				existingDetail
					? {
							variant: existingDetail.variant,
							mixGames: existingDetail.mixGames ?? null,
						}
					: undefined,
				input
			);

			const detailUpdate: Partial<typeof sessionCashDetail.$inferInsert> = {};
			if (input.ruleName !== undefined) {
				detailUpdate.ruleName = input.ruleName;
			}
			if (input.variant !== undefined) {
				detailUpdate.variant = input.variant;
			}
			if (selection.shouldWriteMixGames) {
				detailUpdate.mixGames = selection.mixGames;
			}
			if (input.blind1 !== undefined) {
				detailUpdate.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				detailUpdate.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				detailUpdate.blind3 = input.blind3;
			}
			if (input.ante !== undefined) {
				detailUpdate.ante = input.ante;
			}
			if (input.anteType !== undefined) {
				detailUpdate.anteType = input.anteType;
			}
			if (input.minBuyIn !== undefined) {
				detailUpdate.minBuyIn = input.minBuyIn;
			}
			if (input.maxBuyIn !== undefined) {
				detailUpdate.maxBuyIn = input.maxBuyIn;
			}
			if (input.tableSize !== undefined) {
				detailUpdate.tableSize = input.tableSize;
			}
			if (input.houseRules !== undefined) {
				detailUpdate.houseRules = input.houseRules;
			}
			if (Object.keys(detailUpdate).length > 0) {
				Object.assign(
					detailUpdate,
					cashMixFlatFieldClearPatch(selection.mixGames)
				);
			}
			if (Object.keys(detailUpdate).length === 0) {
				return { id: input.id };
			}
			await applyEntryEventChange(ctx.db, userId, input.id, [], new Date(), [
				ctx.db
					.update(sessionCashDetail)
					.set(detailUpdate)
					.where(eq(sessionCashDetail.sessionId, input.id)),
			]);
			return { id: input.id };
		}),

	complete: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				finalStack: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			if (session.status === "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session is already completed",
				});
			}

			const now = new Date();

			await applyEntryEventChange(
				ctx.db,
				userId,
				input.id,
				{
					op: "append",
					events: [
						{
							type: "session_end",
							occurredAt: floorToMinute(now),
							payload: { cashOutAmount: input.finalStack },
						},
					],
				},
				now
			);

			return { id: input.id, pokerSessionId: input.id };
		}),

	reopen: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			if (session.status !== "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session is not completed",
				});
			}

			const anyActive = await ctx.db
				.select({ id: playSession.id })
				.from(playSession)
				.where(
					and(eq(playSession.userId, userId), ne(playSession.status, "ended"))
				)
				.limit(1);

			if (anyActive.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: ACTIVE_SESSION_CONFLICT_MESSAGE,
				});
			}

			const now = new Date();

			const sessionEndEvent = (
				await listEntryPlayEvents(ctx.db, userId, input.id)
			)
				.filter((event) => event.eventType === "session_end")
				.at(-1);

			if (!sessionEndEvent) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Session end event not found",
				});
			}

			const endPayload = cashSessionEndPayload.parse(
				JSON.parse(sessionEndEvent.payload)
			);
			const cashOutAmount = endPayload.cashOutAmount;
			const endOccurredAt = sessionEndEvent.occurredAt;

			const flooredEndOccurredAt = floorToMinute(endOccurredAt);
			const flooredNow = floorToMinute(now);

			await runUnfinishedLiveSessionWrite(() =>
				persistCashSessionReopenEvents(ctx.db, {
					sessionId: input.id,
					sessionEndEventId: sessionEndEvent.id,
					flooredEndOccurredAt,
					userId,
					cashOutAmount,
					flooredNow,
					now,
				})
			);

			return { id: input.id };
		}),

	discard: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			if (session.status === "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot discard a completed session",
				});
			}

			await runBatch(
				ctx.db,
				buildEntryDeleteStatements(ctx.db, input.id, userId)
			);

			return { id: input.id };
		}),

	updateHeroSeat: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				heroSeatPosition: z
					.number()
					.int()
					.min(0)
					.max(MAX_SEAT_POSITION)
					.nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveCashGameSession(ctx.db, input.id, userId);
			const [detail] = await ctx.db
				.select({ tableSize: sessionCashDetail.tableSize })
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));
			assertSeatPositionFitsTableSize(
				input.heroSeatPosition,
				detail?.tableSize ?? null
			);

			await updateEntryHeroSeat(
				ctx.db,
				userId,
				input.id,
				input.heroSeatPosition,
				new Date()
			);

			return { id: input.id };
		}),
});
