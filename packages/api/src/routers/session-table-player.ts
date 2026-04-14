import {
	playerJoinPayload,
	playerLeavePayload,
} from "@sapphire2/db/constants/session-event-types";
import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { player, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

function validateExactlyOneSessionId(
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined
) {
	if (
		(liveCashGameSessionId && liveTournamentSessionId) ||
		!(liveCashGameSessionId || liveTournamentSessionId)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
		});
	}
}

async function resolveSessionOwnership(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	userId: string
): Promise<{ sessionType: "cash_game" | "tournament" }> {
	if (liveCashGameSessionId) {
		const [session] = await db
			.select()
			.from(liveCashGameSession)
			.where(eq(liveCashGameSession.id, liveCashGameSessionId));
		if (!session || session.userId !== userId) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Session not found",
			});
		}
		return { sessionType: "cash_game" };
	}
	const [session] = await db
		.select()
		.from(liveTournamentSession)
		.where(eq(liveTournamentSession.id, liveTournamentSessionId as string));
	if (!session || session.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Session not found",
		});
	}
	return { sessionType: "tournament" };
}

async function insertPlayerJoinEvent(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	playerId: string
) {
	const now = new Date();
	const nowUnix = Math.floor(now.getTime() / 1000);

	const sessionCond = liveCashGameSessionId
		? eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId)
		: eq(
				sessionEvent.liveTournamentSessionId,
				liveTournamentSessionId as string
			);

	const [maxResult] = await db
		.select({ maxSortOrder: max(sessionEvent.sortOrder) })
		.from(sessionEvent)
		.where(
			and(
				sessionCond,
				sql`(unixepoch(${sessionEvent.occurredAt})) = ${nowUnix}`
			)
		);

	const sortOrder =
		maxResult?.maxSortOrder == null ? 0 : maxResult.maxSortOrder + 1;

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		liveCashGameSessionId: liveCashGameSessionId ?? null,
		liveTournamentSessionId: liveTournamentSessionId ?? null,
		eventType: "player_join",
		occurredAt: now,
		sortOrder,
		payload: JSON.stringify({ playerId }),
		updatedAt: now,
	});
}

async function insertPlayerLeaveEvent(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	playerId: string
) {
	const now = new Date();
	const nowUnix = Math.floor(now.getTime() / 1000);

	const sessionCond = liveCashGameSessionId
		? eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId)
		: eq(
				sessionEvent.liveTournamentSessionId,
				liveTournamentSessionId as string
			);

	const [maxResult] = await db
		.select({ maxSortOrder: max(sessionEvent.sortOrder) })
		.from(sessionEvent)
		.where(
			and(
				sessionCond,
				sql`(unixepoch(${sessionEvent.occurredAt})) = ${nowUnix}`
			)
		);

	const sortOrder =
		maxResult?.maxSortOrder == null ? 0 : maxResult.maxSortOrder + 1;

	await db.insert(sessionEvent).values({
		id: crypto.randomUUID(),
		liveCashGameSessionId: liveCashGameSessionId ?? null,
		liveTournamentSessionId: liveTournamentSessionId ?? null,
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

async function recoverSeatStateFromEvents(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined
) {
	const sessionCond = liveCashGameSessionId
		? eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId)
		: eq(
				sessionEvent.liveTournamentSessionId,
				liveTournamentSessionId as string
			);

	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
			occurredAt: sessionEvent.occurredAt,
			sortOrder: sessionEvent.sortOrder,
		})
		.from(sessionEvent)
		.where(sessionCond)
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

export const sessionTablePlayerRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
				activeOnly: z.boolean().default(false),
			})
		)
		.query(async ({ ctx, input }) => {
			const { liveCashGameSessionId, liveTournamentSessionId, activeOnly } =
				input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			const sessionCond = liveCashGameSessionId
				? eq(sessionTablePlayer.liveCashGameSessionId, liveCashGameSessionId)
				: eq(
						sessionTablePlayer.liveTournamentSessionId,
						liveTournamentSessionId as string
					);

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
				})
				.from(sessionTablePlayer)
				.innerJoin(player, eq(player.id, sessionTablePlayer.playerId))
				.where(sessionCond)
				.orderBy(asc(sessionTablePlayer.joinedAt));

			const recoveredSeatState = await recoverSeatStateFromEvents(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const items = rows.map((row) => {
				const recovered = recoveredSeatState.get(row.playerId);
				const isActive = recovered?.isActive ?? row.isActive === 1;

				return {
					id: row.id,
					player: {
						id: row.playerId,
						name: row.playerName,
						memo: row.playerMemo,
					},
					isActive,
					joinedAt: recovered?.lastJoinedAt ?? row.joinedAt,
					leftAt: recovered?.lastLeftAt ?? row.leftAt ?? null,
					seatPosition: row.seatPosition ?? null,
				};
			});

			return {
				items: activeOnly ? items.filter((item) => item.isActive) : items,
			};
		}),

	add: protectedProcedure
		.input(
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
				playerId: z.string().min(1),
				seatPosition: z.number().int().min(0).max(8).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const {
				liveCashGameSessionId,
				liveTournamentSessionId,
				playerId,
				seatPosition,
			} = input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			// Check player exists and belongs to user
			const [foundPlayer] = await ctx.db
				.select()
				.from(player)
				.where(and(eq(player.id, playerId), eq(player.userId, userId)));
			if (!foundPlayer) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
			}

			// Check if player is already active in this session
			const sessionCond = liveCashGameSessionId
				? eq(sessionTablePlayer.liveCashGameSessionId, liveCashGameSessionId)
				: eq(
						sessionTablePlayer.liveTournamentSessionId,
						liveTournamentSessionId as string
					);
			const [existing] = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(and(sessionCond, eq(sessionTablePlayer.playerId, playerId)));

			const recoveredSeatState = await recoverSeatStateFromEvents(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId
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
				// Reactivate
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
					liveCashGameSessionId: liveCashGameSessionId ?? null,
					liveTournamentSessionId: liveTournamentSessionId ?? null,
					playerId,
					isActive: 1,
					joinedAt: now,
					updatedAt: now,
					...(seatPosition !== undefined && { seatPosition }),
				});
			}

			await insertPlayerJoinEvent(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				playerId
			);

			return { id: tablePlayerId };
		}),

	addNew: protectedProcedure
		.input(
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
				playerMemo: z.string().optional(),
				playerName: z.string().min(1),
				playerTagIds: z.array(z.string()).optional(),
				seatPosition: z.number().int().min(0).max(8).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { liveCashGameSessionId, liveTournamentSessionId, seatPosition } =
				input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

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
				liveCashGameSessionId: liveCashGameSessionId ?? null,
				liveTournamentSessionId: liveTournamentSessionId ?? null,
				playerId,
				updatedAt: now,
				...(seatPosition !== undefined && { seatPosition }),
			});

			await insertPlayerJoinEvent(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				playerId
			);

			return { id: tablePlayerId, playerId };
		}),

	updateSeat: protectedProcedure
		.input(
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
				playerId: z.string().min(1),
				seatPosition: z.number().int().min(0).max(8).nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { liveCashGameSessionId, liveTournamentSessionId, playerId } =
				input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			const sessionCond = liveCashGameSessionId
				? eq(sessionTablePlayer.liveCashGameSessionId, liveCashGameSessionId)
				: eq(
						sessionTablePlayer.liveTournamentSessionId,
						liveTournamentSessionId as string
					);

			const [existing] = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(and(sessionCond, eq(sessionTablePlayer.playerId, playerId)));

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
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
				playerId: z.string().min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { liveCashGameSessionId, liveTournamentSessionId, playerId } =
				input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			const sessionCond = liveCashGameSessionId
				? eq(sessionTablePlayer.liveCashGameSessionId, liveCashGameSessionId)
				: eq(
						sessionTablePlayer.liveTournamentSessionId,
						liveTournamentSessionId as string
					);

			const [existing] = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(and(sessionCond, eq(sessionTablePlayer.playerId, playerId)));

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found in session",
				});
			}
			const recoveredSeatState = await recoverSeatStateFromEvents(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId
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

			await insertPlayerLeaveEvent(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				playerId
			);

			return { id: existing.id };
		}),
});
