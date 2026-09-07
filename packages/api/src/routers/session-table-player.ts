import {
	MAX_SEAT_POSITION,
	playerJoinPayload,
} from "@sapphire2/db/constants/session-event-types";
import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { type BatchStatement, runBatch } from "../lib/batch";
import { computeSeatedPlayersFromEvents } from "../services/live-session-pl";
import { assertSeatPositionFitsTableSize } from "../utils/seat-position";
import {
	floorToMinute,
	nextAppendSortOrderSql,
	sessionEventOrderBy,
} from "../utils/session-event-time";
import {
	chunkForInsert,
	selectInChunks,
	validateTagsOwnership,
} from "./session";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

function resolveSessionId(input: {
	sessionId?: string;
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}): string | undefined {
	return (
		input.sessionId ??
		input.liveCashGameSessionId ??
		input.liveTournamentSessionId
	);
}

async function resolveSessionOwnership(
	db: DbInstance,
	sessionId: string,
	userId: string
): Promise<{ sessionType: "cash_game" | "tournament" }> {
	const [session] = await db
		.select()
		.from(gameSession)
		.where(and(eq(gameSession.id, sessionId), eq(gameSession.userId, userId)));
	if (!session || session.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this session",
		});
	}
	return { sessionType: session.kind as "cash_game" | "tournament" };
}

async function validatePlayerOwnership(
	db: DbInstance,
	playerId: string,
	userId: string
): Promise<void> {
	const [ownedPlayer] = await db
		.select({ id: player.id })
		.from(player)
		.where(and(eq(player.id, playerId), eq(player.userId, userId)));
	if (!ownedPlayer) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this player",
		});
	}
}

async function validateSeatPositionForSession(
	db: DbInstance,
	sessionId: string,
	sessionType: "cash_game" | "tournament",
	seatPosition: number | null | undefined
): Promise<void> {
	if (seatPosition === null || seatPosition === undefined) {
		return;
	}
	const [detail] =
		sessionType === "cash_game"
			? await db
					.select({ tableSize: sessionCashDetail.tableSize })
					.from(sessionCashDetail)
					.where(eq(sessionCashDetail.sessionId, sessionId))
			: await db
					.select({ tableSize: sessionTournamentDetail.tableSize })
					.from(sessionTournamentDetail)
					.where(eq(sessionTournamentDetail.sessionId, sessionId));
	assertSeatPositionFitsTableSize(seatPosition, detail?.tableSize ?? null);
}

function fetchSeatEvents(db: DbInstance, sessionId: string) {
	return db
		.select({
			id: sessionEvent.id,
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
			occurredAt: sessionEvent.occurredAt,
			sortOrder: sessionEvent.sortOrder,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(...sessionEventOrderBy());
}

function buildPlayerJoinEventStatement(
	db: DbInstance,
	sessionId: string,
	playerId: string,
	seatPosition?: number
): { statement: BatchStatement } {
	const now = new Date();
	const payload: { playerId: string; seatPosition?: number } = { playerId };
	if (seatPosition !== undefined) {
		payload.seatPosition = seatPosition;
	}

	return {
		statement: db.insert(sessionEvent).values({
			id: crypto.randomUUID(),
			sessionId,
			eventType: "player_join",
			occurredAt: floorToMinute(now),
			sortOrder: nextAppendSortOrderSql(sessionId),
			payload: JSON.stringify(payload),
			updatedAt: now,
		}) as unknown as BatchStatement,
	};
}

export async function insertPlayerJoinEvent(
	db: DbInstance,
	sessionId: string,
	playerId: string,
	seatPosition?: number
) {
	const { statement } = buildPlayerJoinEventStatement(
		db,
		sessionId,
		playerId,
		seatPosition
	);
	await statement;
}

export async function insertPlayerLeaveEvent(
	db: DbInstance,
	sessionId: string,
	playerId: string
) {
	const now = new Date();
	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType: "player_leave",
		occurredAt: floorToMinute(now),
		sortOrder: nextAppendSortOrderSql(sessionId),
		payload: JSON.stringify({ playerId }),
		updatedAt: now,
	});
}

const TEMPORARY_PLAYER_NAME = "Anonymous";

const sessionIdInput = z.object({
	sessionId: z.string().optional(),
	liveCashGameSessionId: z.string().optional(),
	liveTournamentSessionId: z.string().optional(),
});

function requireSessionId(input: {
	sessionId?: string;
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}): string {
	const sessionId = resolveSessionId(input);
	if (!sessionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
		});
	}
	return sessionId;
}

export const sessionTablePlayerRouter = router({
	list: protectedProcedure
		.input(
			sessionIdInput.extend({
				activeOnly: z.boolean().default(false),
			})
		)
		.query(async ({ ctx, input }) => {
			const sessionId = requireSessionId(input);
			const userId = ctx.session.user.id;
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const events = await fetchSeatEvents(ctx.db, sessionId);
			const seated = computeSeatedPlayersFromEvents(events);

			if (seated.length === 0) {
				return { items: [] };
			}

			const playerRows = await selectInChunks(
				seated.map((state) => state.playerId),
				(chunk) =>
					ctx.db
						.select({
							id: player.id,
							name: player.name,
							memo: player.memo,
							isTemporary: player.isTemporary,
						})
						.from(player)
						.where(and(eq(player.userId, userId), inArray(player.id, chunk))),
				1
			);
			const playerById = new Map(playerRows.map((p) => [p.id, p]));

			const items: {
				id: string;
				player: {
					id: string;
					isTemporary: boolean;
					memo: string | null;
					name: string;
				};
				isActive: boolean;
				joinedAt: Date;
				leftAt: Date | null;
				seatPosition: number | null;
				stints: {
					joinedAt: Date;
					leftAt: Date | null;
					seatPosition: number | null;
				}[];
			}[] = [];
			for (const state of seated) {
				const foundPlayer = playerById.get(state.playerId);
				if (!foundPlayer) {
					continue;
				}
				items.push({
					id: state.playerId,
					player: {
						id: foundPlayer.id,
						isTemporary: foundPlayer.isTemporary,
						memo: foundPlayer.memo,
						name: foundPlayer.name,
					},
					isActive: state.isActive,
					joinedAt: state.joinedAt,
					leftAt: state.leftAt,
					seatPosition: state.seatPosition,
					stints: state.stints,
				});
			}
			items.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

			return {
				items: input.activeOnly ? items.filter((item) => item.isActive) : items,
			};
		}),

	add: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerId: z.string().min(1),
				seatPosition: z.number().int().min(0).max(MAX_SEAT_POSITION).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = requireSessionId(input);
			const { playerId, seatPosition } = input;
			const userId = ctx.session.user.id;
			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				sessionId,
				userId
			);
			await validatePlayerOwnership(ctx.db, playerId, userId);
			await validateSeatPositionForSession(
				ctx.db,
				sessionId,
				sessionType,
				seatPosition
			);

			const events = await fetchSeatEvents(ctx.db, sessionId);
			const seated = computeSeatedPlayersFromEvents(events);
			const isActive = seated.some(
				(s) => s.playerId === playerId && s.isActive
			);
			if (isActive) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Player is already active in this session",
				});
			}

			await insertPlayerJoinEvent(ctx.db, sessionId, playerId, seatPosition);

			return { id: playerId, playerId };
		}),

	addNew: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerMemo: z.string().optional(),
				playerName: z.string().min(1),
				playerTagIds: z.array(z.string()).optional(),
				seatPosition: z.number().int().min(0).max(MAX_SEAT_POSITION).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = requireSessionId(input);
			const { seatPosition } = input;
			const userId = ctx.session.user.id;
			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				sessionId,
				userId
			);
			await validateSeatPositionForSession(
				ctx.db,
				sessionId,
				sessionType,
				seatPosition
			);
			await validateTagsOwnership(
				ctx.db,
				playerTag,
				input.playerTagIds,
				userId
			);

			const now = new Date();
			const playerId = crypto.randomUUID();
			const statements: BatchStatement[] = [
				ctx.db.insert(player).values({
					id: playerId,
					memo: input.playerMemo ?? null,
					name: input.playerName,
					updatedAt: now,
					userId,
				}) as unknown as BatchStatement,
			];

			if (input.playerTagIds && input.playerTagIds.length > 0) {
				const tagRows = input.playerTagIds.map((tagId, index) => ({
					playerId,
					playerTagId: tagId,
					position: index,
				}));
				for (const chunk of chunkForInsert(tagRows, 3)) {
					statements.push(
						ctx.db
							.insert(playerToPlayerTag)
							.values(chunk) as unknown as BatchStatement
					);
				}
			}

			const { statement: joinStatement } = await buildPlayerJoinEventStatement(
				ctx.db,
				sessionId,
				playerId,
				seatPosition
			);
			statements.push(joinStatement);
			await runBatch(ctx.db, statements);

			return { id: playerId, playerId };
		}),

	updateSeat: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerId: z.string().min(1),
				seatPosition: z.number().int().min(0).max(MAX_SEAT_POSITION).nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = requireSessionId(input);
			const { playerId, seatPosition } = input;
			const userId = ctx.session.user.id;
			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				sessionId,
				userId
			);
			await validatePlayerOwnership(ctx.db, playerId, userId);
			await validateSeatPositionForSession(
				ctx.db,
				sessionId,
				sessionType,
				seatPosition
			);

			const events = await fetchSeatEvents(ctx.db, sessionId);
			const seated = computeSeatedPlayersFromEvents(events);
			const isActive = seated.some(
				(s) => s.playerId === playerId && s.isActive
			);
			if (!isActive) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found in session",
				});
			}

			let joinEventId: string | undefined;
			for (const event of events) {
				if (event.eventType !== "player_join") {
					continue;
				}
				const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
				if (parsed.success && parsed.data.playerId === playerId) {
					joinEventId = event.id;
				}
			}
			if (!joinEventId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found in session",
				});
			}

			const payload: { playerId: string; seatPosition?: number } = {
				playerId,
			};
			if (seatPosition !== null) {
				payload.seatPosition = seatPosition;
			}
			await ctx.db
				.update(sessionEvent)
				.set({ payload: JSON.stringify(payload), updatedAt: new Date() })
				.where(eq(sessionEvent.id, joinEventId));

			return { id: playerId, playerId };
		}),

	remove: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerId: z.string().min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = requireSessionId(input);
			const { playerId } = input;
			const userId = ctx.session.user.id;
			await resolveSessionOwnership(ctx.db, sessionId, userId);
			await validatePlayerOwnership(ctx.db, playerId, userId);

			const events = await fetchSeatEvents(ctx.db, sessionId);
			const seated = computeSeatedPlayersFromEvents(events);
			const isActive = seated.some(
				(s) => s.playerId === playerId && s.isActive
			);
			if (!isActive) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Player is not active in this session",
				});
			}

			await insertPlayerLeaveEvent(ctx.db, sessionId, playerId);

			return { id: playerId, playerId };
		}),

	addTemporary: protectedProcedure
		.input(
			sessionIdInput.extend({
				seatPosition: z.number().int().min(0).max(MAX_SEAT_POSITION).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = requireSessionId(input);
			const { seatPosition } = input;
			const userId = ctx.session.user.id;
			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				sessionId,
				userId
			);
			await validateSeatPositionForSession(
				ctx.db,
				sessionId,
				sessionType,
				seatPosition
			);

			const now = new Date();
			const playerId = crypto.randomUUID();
			const statements: BatchStatement[] = [
				ctx.db.insert(player).values({
					id: playerId,
					isTemporary: true,
					name: TEMPORARY_PLAYER_NAME,
					updatedAt: now,
					userId,
				}) as unknown as BatchStatement,
			];

			const { statement: joinStatement } = await buildPlayerJoinEventStatement(
				ctx.db,
				sessionId,
				playerId,
				seatPosition
			);
			statements.push(joinStatement);
			await runBatch(ctx.db, statements);

			return { id: playerId, playerId };
		}),
});
