import {
	MAX_SEAT_POSITION,
	playerJoinPayload,
} from "@sapphire2/db/constants/session-event-types";
import { player, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { computeSeatedPlayersFromEvents } from "../services/live-session-pl";
import {
	floorToMinute,
	nextAppendSortOrder,
} from "../utils/session-event-time";

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
		.where(eq(gameSession.id, sessionId));
	if (!session || session.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Session not found",
		});
	}
	return { sessionType: session.kind as "cash_game" | "tournament" };
}

async function fetchSessionContext(
	db: DbInstance,
	sessionId: string,
	sessionType: "cash_game" | "tournament"
): Promise<{ roomName: string | null; gameName: string | null }> {
	let roomName: string | null = null;
	let gameName: string | null = null;
	let roomId: string | null = null;

	const [session] = await db
		.select({ roomId: gameSession.roomId })
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	roomId = session?.roomId ?? null;

	if (sessionType === "cash_game") {
		const [cashDetail] = await db
			.select({ ringGameId: sessionCashDetail.ringGameId })
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, sessionId));
		if (cashDetail?.ringGameId) {
			const [gameRow] = await db
				.select({
					blind1: ringGame.blind1,
					blind2: ringGame.blind2,
					name: ringGame.name,
				})
				.from(ringGame)
				.where(eq(ringGame.id, cashDetail.ringGameId));
			if (gameRow) {
				const blinds =
					gameRow.blind1 !== null && gameRow.blind2 !== null
						? ` ${gameRow.blind1}/${gameRow.blind2}`
						: "";
				gameName = `${gameRow.name}${blinds}`;
			}
		}
	} else {
		const [tournDetail] = await db
			.select({ tournamentId: sessionTournamentDetail.tournamentId })
			.from(sessionTournamentDetail)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
		if (tournDetail?.tournamentId) {
			const [tourneyRow] = await db
				.select({ name: tournament.name })
				.from(tournament)
				.where(eq(tournament.id, tournDetail.tournamentId));
			gameName = tourneyRow?.name ?? null;
		}
	}

	if (roomId) {
		const [roomRow] = await db
			.select({ name: room.name })
			.from(room)
			.where(eq(room.id, roomId));
		roomName = roomRow?.name ?? null;
	}

	return { roomName, gameName };
}

/**
 * Fetch the session's events ordered for event-sourced state derivation.
 * Seated-player state is no longer persisted in a table — every read folds
 * the player_join / player_leave event stream instead.
 */
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
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));
}

export async function insertPlayerJoinEvent(
	db: DbInstance,
	sessionId: string,
	playerId: string,
	seatPosition?: number
) {
	const now = new Date();
	const sortOrder = await nextAppendSortOrder(db, sessionId);

	const payload: { playerId: string; seatPosition?: number } = { playerId };
	if (seatPosition !== undefined) {
		payload.seatPosition = seatPosition;
	}

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType: "player_join",
		occurredAt: floorToMinute(now),
		sortOrder,
		payload: JSON.stringify(payload),
		updatedAt: now,
	});
}

export async function insertPlayerLeaveEvent(
	db: DbInstance,
	sessionId: string,
	playerId: string
) {
	const now = new Date();
	const sortOrder = await nextAppendSortOrder(db, sessionId);

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType: "player_leave",
		occurredAt: floorToMinute(now),
		sortOrder,
		payload: JSON.stringify({ playerId }),
		updatedAt: now,
	});
}

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

			const playerRows = await ctx.db
				.select({
					id: player.id,
					name: player.name,
					memo: player.memo,
					isTemporary: player.isTemporary,
				})
				.from(player)
				.where(
					inArray(
						player.id,
						seated.map((s) => s.playerId)
					)
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
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const [foundPlayer] = await ctx.db
				.select()
				.from(player)
				.where(and(eq(player.id, playerId), eq(player.userId, userId)));
			if (!foundPlayer) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
			}

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
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const now = new Date();
			const playerId = crypto.randomUUID();
			await ctx.db.insert(player).values({
				id: playerId,
				memo: input.playerMemo ?? null,
				name: input.playerName,
				updatedAt: now,
				userId,
			});

			if (input.playerTagIds && input.playerTagIds.length > 0) {
				await ctx.db.insert(playerToPlayerTag).values(
					input.playerTagIds.map((tagId, index) => ({
						playerId,
						playerTagId: tagId,
						position: index,
					}))
				);
			}

			await insertPlayerJoinEvent(ctx.db, sessionId, playerId, seatPosition);

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
			await resolveSessionOwnership(ctx.db, sessionId, userId);

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

			// The seat lives on the player's most recent player_join event.
			// Patching that event keeps the seat fully event-sourced.
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

			const { roomName, gameName } = await fetchSessionContext(
				ctx.db,
				sessionId,
				sessionType
			);

			const now = new Date();
			const hh = String(now.getUTCHours()).padStart(2, "0");
			const mm = String(now.getUTCMinutes()).padStart(2, "0");
			const dateStr = now.toISOString().slice(0, 10);
			const memoLines = [`Joined: ${dateStr} ${hh}:${mm}`];
			if (roomName) {
				memoLines.push(`Room: ${roomName}`);
			}
			if (gameName) {
				memoLines.push(`Game: ${gameName}`);
			}
			if (seatPosition !== undefined) {
				memoLines.push(`Seat: ${seatPosition + 1}`);
			}
			const memo = `<p>${memoLines.join("<br>")}</p>`;

			const finalName = "Anonymous";

			const playerId = crypto.randomUUID();
			await ctx.db.insert(player).values({
				id: playerId,
				isTemporary: true,
				memo,
				name: finalName,
				updatedAt: now,
				userId,
			});

			await insertPlayerJoinEvent(ctx.db, sessionId, playerId, seatPosition);

			return { id: playerId, playerId };
		}),
});
