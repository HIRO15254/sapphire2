import {
	playerJoinPayload,
	playerLeavePayload,
} from "@sapphire2/db/constants/session-event-types";
import { player, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { store } from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

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
): Promise<{ storeName: string | null; gameName: string | null }> {
	let storeName: string | null = null;
	let gameName: string | null = null;
	let storeId: string | null = null;

	const [session] = await db
		.select({ storeId: gameSession.storeId })
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	storeId = session?.storeId ?? null;

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

	if (storeId) {
		const [storeRow] = await db
			.select({ name: store.name })
			.from(store)
			.where(eq(store.id, storeId));
		storeName = storeRow?.name ?? null;
	}

	return { storeName, gameName };
}

async function insertPlayerJoinEvent(
	db: DbInstance,
	sessionId: string,
	playerId: string
) {
	const now = new Date();
	const nowUnix = Math.floor(now.getTime() / 1000);

	const [maxResult] = await db
		.select({ maxSortOrder: max(sessionEvent.sortOrder) })
		.from(sessionEvent)
		.where(
			and(
				eq(sessionEvent.sessionId, sessionId),
				sql`(unixepoch(${sessionEvent.occurredAt})) = ${nowUnix}`
			)
		);

	const sortOrder =
		maxResult?.maxSortOrder == null ? 0 : maxResult.maxSortOrder + 1;

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType: "player_join",
		occurredAt: now,
		sortOrder,
		payload: JSON.stringify({ playerId }),
		updatedAt: now,
	});
}

async function insertPlayerLeaveEvent(
	db: DbInstance,
	sessionId: string,
	playerId: string
) {
	const now = new Date();
	const nowUnix = Math.floor(now.getTime() / 1000);

	const [maxResult] = await db
		.select({ maxSortOrder: max(sessionEvent.sortOrder) })
		.from(sessionEvent)
		.where(
			and(
				eq(sessionEvent.sessionId, sessionId),
				sql`(unixepoch(${sessionEvent.occurredAt})) = ${nowUnix}`
			)
		);

	const sortOrder =
		maxResult?.maxSortOrder == null ? 0 : maxResult.maxSortOrder + 1;

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType: "player_leave",
		occurredAt: now,
		sortOrder,
		payload: JSON.stringify({ playerId }),
		updatedAt: now,
	});
}

interface RecoveredSeatState {
	isActive: boolean;
	lastJoinedAt: Date | null;
	lastLeftAt: Date | null;
}

async function recoverSeatStateFromEvents(db: DbInstance, sessionId: string) {
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
			occurredAt: sessionEvent.occurredAt,
			sortOrder: sessionEvent.sortOrder,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

	const stateByPlayerId = new Map<string, RecoveredSeatState>();

	for (const event of events) {
		if (event.eventType === "player_join") {
			const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
			const playerId = parsed.success ? parsed.data.playerId : undefined;
			if (!playerId) {
				continue;
			}
			stateByPlayerId.set(playerId, {
				isActive: true,
				lastJoinedAt: event.occurredAt,
				lastLeftAt: null,
			});
			continue;
		}

		if (event.eventType === "player_leave") {
			const parsed = playerLeavePayload.safeParse(JSON.parse(event.payload));
			const playerId = parsed.success ? parsed.data.playerId : undefined;
			if (!playerId) {
				continue;
			}
			const current = stateByPlayerId.get(playerId);
			stateByPlayerId.set(playerId, {
				isActive: false,
				lastJoinedAt: current?.lastJoinedAt ?? null,
				lastLeftAt: event.occurredAt,
			});
		}
	}

	return stateByPlayerId;
}

const sessionIdInput = z.object({
	sessionId: z.string().optional(),
	liveCashGameSessionId: z.string().optional(),
	liveTournamentSessionId: z.string().optional(),
});

export const sessionTablePlayerRouter = router({
	list: protectedProcedure
		.input(
			sessionIdInput.extend({
				activeOnly: z.boolean().default(false),
			})
		)
		.query(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const rows = await ctx.db
				.select({
					id: sessionTablePlayer.id,
					isActive: sessionTablePlayer.isActive,
					joinedAt: sessionTablePlayer.joinedAt,
					leftAt: sessionTablePlayer.leftAt,
					seatPosition: sessionTablePlayer.seatPosition,
					playerId: player.id,
					playerName: player.name,
					playerMemo: player.memo,
					playerIsTemporary: player.isTemporary,
				})
				.from(sessionTablePlayer)
				.innerJoin(player, eq(player.id, sessionTablePlayer.playerId))
				.where(eq(sessionTablePlayer.sessionId, sessionId))
				.orderBy(asc(sessionTablePlayer.joinedAt));

			const recoveredSeatState = await recoverSeatStateFromEvents(
				ctx.db,
				sessionId
			);

			const items = rows.map((row) => {
				const recovered = recoveredSeatState.get(row.playerId);
				const isActive = recovered?.isActive ?? row.isActive === 1;

				return {
					id: row.id,
					player: {
						id: row.playerId,
						isTemporary: row.playerIsTemporary,
						memo: row.playerMemo,
						name: row.playerName,
					},
					isActive,
					joinedAt: recovered?.lastJoinedAt ?? row.joinedAt,
					leftAt: recovered?.lastLeftAt ?? row.leftAt ?? null,
					seatPosition: row.seatPosition ?? null,
				};
			});

			return {
				items: input.activeOnly ? items.filter((item) => item.isActive) : items,
			};
		}),

	add: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerId: z.string().min(1),
				seatPosition: z.number().int().min(0).max(8).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

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

			const [existing] = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(
					and(
						eq(sessionTablePlayer.sessionId, sessionId),
						eq(sessionTablePlayer.playerId, playerId)
					)
				);

			const recoveredSeatState = await recoverSeatStateFromEvents(
				ctx.db,
				sessionId
			);
			const isActiveByEvent =
				recoveredSeatState.get(playerId)?.isActive ?? false;

			if (isActiveByEvent) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Player is already active in this session",
				});
			}

			const now = new Date();
			let tablePlayerId: string;

			if (existing) {
				tablePlayerId = existing.id;
				await ctx.db
					.update(sessionTablePlayer)
					.set({
						isActive: 1,
						joinedAt: now,
						leftAt: null,
						updatedAt: now,
						...(seatPosition !== undefined && { seatPosition }),
					})
					.where(eq(sessionTablePlayer.id, existing.id));
			} else {
				tablePlayerId = crypto.randomUUID();
				await ctx.db.insert(sessionTablePlayer).values({
					id: tablePlayerId,
					sessionId,
					playerId,
					isActive: 1,
					joinedAt: now,
					updatedAt: now,
					...(seatPosition !== undefined && { seatPosition }),
				});
			}

			await insertPlayerJoinEvent(ctx.db, sessionId, playerId);

			return { id: tablePlayerId };
		}),

	addNew: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerMemo: z.string().optional(),
				playerName: z.string().min(1),
				playerTagIds: z.array(z.string()).optional(),
				seatPosition: z.number().int().min(0).max(8).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

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

			const tablePlayerId = crypto.randomUUID();
			await ctx.db.insert(sessionTablePlayer).values({
				id: tablePlayerId,
				isActive: 1,
				joinedAt: now,
				sessionId,
				playerId,
				updatedAt: now,
				...(seatPosition !== undefined && { seatPosition }),
			});

			await insertPlayerJoinEvent(ctx.db, sessionId, playerId);

			return { id: tablePlayerId, playerId };
		}),

	updateSeat: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerId: z.string().min(1),
				seatPosition: z.number().int().min(0).max(8).nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

			const { playerId } = input;
			const userId = ctx.session.user.id;
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const [existing] = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(
					and(
						eq(sessionTablePlayer.sessionId, sessionId),
						eq(sessionTablePlayer.playerId, playerId)
					)
				);

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found in session",
				});
			}

			const now = new Date();
			await ctx.db
				.update(sessionTablePlayer)
				.set({ seatPosition: input.seatPosition, updatedAt: now })
				.where(eq(sessionTablePlayer.id, existing.id));

			return { id: existing.id };
		}),

	remove: protectedProcedure
		.input(
			sessionIdInput.extend({
				playerId: z.string().min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

			const { playerId } = input;
			const userId = ctx.session.user.id;
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const [existing] = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(
					and(
						eq(sessionTablePlayer.sessionId, sessionId),
						eq(sessionTablePlayer.playerId, playerId)
					)
				);

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found in session",
				});
			}

			const recoveredSeatState = await recoverSeatStateFromEvents(
				ctx.db,
				sessionId
			);
			const isActiveByEvent =
				recoveredSeatState.get(playerId)?.isActive ?? false;

			if (!isActiveByEvent) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Player is not active in this session",
				});
			}

			const now = new Date();
			await ctx.db
				.update(sessionTablePlayer)
				.set({ isActive: 0, leftAt: now, updatedAt: now })
				.where(eq(sessionTablePlayer.id, existing.id));

			await insertPlayerLeaveEvent(ctx.db, sessionId, playerId);

			return { id: existing.id };
		}),

	addTemporary: protectedProcedure
		.input(
			sessionIdInput.extend({
				seatPosition: z.number().int().min(0).max(8).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

			const { seatPosition } = input;
			const userId = ctx.session.user.id;
			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				sessionId,
				userId
			);

			const { storeName, gameName } = await fetchSessionContext(
				ctx.db,
				sessionId,
				sessionType
			);

			const now = new Date();
			const hh = String(now.getUTCHours()).padStart(2, "0");
			const mm = String(now.getUTCMinutes()).padStart(2, "0");
			const dateStr = now.toISOString().slice(0, 10);
			const memoLines = [`Joined: ${dateStr} ${hh}:${mm}`];
			if (storeName) {
				memoLines.push(`Store: ${storeName}`);
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

			const tablePlayerId = crypto.randomUUID();
			await ctx.db.insert(sessionTablePlayer).values({
				id: tablePlayerId,
				isActive: 1,
				joinedAt: now,
				sessionId,
				playerId,
				updatedAt: now,
				...(seatPosition !== undefined && { seatPosition }),
			});

			await insertPlayerJoinEvent(ctx.db, sessionId, playerId);

			return { id: tablePlayerId, playerId };
		}),
});
