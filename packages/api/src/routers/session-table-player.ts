import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { player, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
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

			const sessionEventCond = liveCashGameSessionId
				? eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId)
				: eq(
						sessionEvent.liveTournamentSessionId,
						liveTournamentSessionId as string
					);

			const events = await ctx.db
				.select({
					eventType: sessionEvent.eventType,
					occurredAt: sessionEvent.occurredAt,
					sortOrder: sessionEvent.sortOrder,
					payload: sessionEvent.payload,
				})
				.from(sessionEvent)
				.where(sessionEventCond)
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			type DerivedTablePlayer = {
				isActive: boolean;
				joinedAt: Date;
				leftAt: Date | null;
			};
			const derivedByPlayerId = new Map<string, DerivedTablePlayer>();

			for (const event of events) {
				if (
					event.eventType !== "player_join" &&
					event.eventType !== "player_leave"
				) {
					continue;
				}

				const payload = JSON.parse(event.payload) as { playerId?: string };
				if (!payload.playerId) {
					continue;
				}

				if (event.eventType === "player_join") {
					derivedByPlayerId.set(payload.playerId, {
						isActive: true,
						joinedAt: event.occurredAt,
						leftAt: null,
					});
				} else {
					const existing = derivedByPlayerId.get(payload.playerId);
					derivedByPlayerId.set(payload.playerId, {
						isActive: false,
						joinedAt: existing?.joinedAt ?? event.occurredAt,
						leftAt: event.occurredAt,
					});
				}
			}

			const playerIds = [...derivedByPlayerId.keys()];
			if (playerIds.length === 0) {
				return { items: [] };
			}

			const players = await ctx.db
				.select({ id: player.id, name: player.name, memo: player.memo })
				.from(player)
				.where(and(inArray(player.id, playerIds), eq(player.userId, userId)));

			const tableSessionCond = liveCashGameSessionId
				? eq(sessionTablePlayer.liveCashGameSessionId, liveCashGameSessionId)
				: eq(
						sessionTablePlayer.liveTournamentSessionId,
						liveTournamentSessionId as string
					);

			const tableRows = await ctx.db
				.select({
					id: sessionTablePlayer.id,
					playerId: sessionTablePlayer.playerId,
					seatPosition: sessionTablePlayer.seatPosition,
				})
				.from(sessionTablePlayer)
				.where(and(tableSessionCond, inArray(sessionTablePlayer.playerId, playerIds)));

			const tableRowByPlayerId = new Map(
				tableRows.map((row) => [row.playerId, row] as const)
			);

			const items = players
				.map((playerRow) => {
					const derived = derivedByPlayerId.get(playerRow.id);
					if (!derived) {
						return null;
					}

					const tableRow = tableRowByPlayerId.get(playerRow.id);
					return {
						id: tableRow?.id ?? `derived-${playerRow.id}`,
						player: {
							id: playerRow.id,
							name: playerRow.name,
							memo: playerRow.memo,
						},
						isActive: derived.isActive,
						joinedAt: derived.joinedAt,
						leftAt: derived.leftAt,
						seatPosition: tableRow?.seatPosition ?? null,
					};
				})
				.filter(
					(
						item
					): item is {
						id: string;
						player: { id: string; memo: string | null; name: string };
						isActive: boolean;
						joinedAt: Date;
						leftAt: Date | null;
						seatPosition: number | null;
					} => item !== null
				)
				.filter((item) => (activeOnly ? item.isActive : true))
				.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

			return { items };
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

			if (existing?.isActive === 1) {
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
			if (existing.isActive === 0) {
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
