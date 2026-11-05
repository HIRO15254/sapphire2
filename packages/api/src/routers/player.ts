import { playEvent } from "@sapphire2/db/schema/entry";
import { handSeat } from "@sapphire2/db/schema/hand";
import { player, playerTag, playerTagLink } from "@sapphire2/db/schema/player";
import { idSchema } from "@sapphire2/db/schemas/id";
import { tagIdsSchema } from "@sapphire2/db/schemas/tag-ids";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, exists, inArray, not, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	type BatchStatement,
	insertChunks,
	runBatch,
	selectInChunks,
} from "../lib/batch";
import { memoSchema, playerNameSchema } from "../lib/master-input-schemas";
import {
	validateEntityOwnership,
	validateTagsOwnership,
} from "../lib/ownership";
import {
	listPlayerHands,
	playerHandStats,
	playerHandStatsInputSchema,
	playerHandsInputSchema,
} from "../services/player-hands";
import { ensureSelfPlayer } from "../services/self-player";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

interface PlayerTagOutput {
	color: string;
	id: string;
	name: string;
}

export const playerListInputSchema = z
	.object({
		search: z.string().max(100).optional(),
		tagIds: tagIdsSchema.optional(),
	})
	.optional();

async function tagsByPlayer(
	db: DbInstance,
	userId: string,
	playerIds: string[]
): Promise<Map<string, PlayerTagOutput[]>> {
	const links = await selectInChunks(
		playerIds,
		(chunk) =>
			db
				.select({
					playerId: playerTagLink.playerId,
					id: playerTag.id,
					name: playerTag.name,
					color: playerTag.color,
				})
				.from(playerTagLink)
				.innerJoin(
					playerTag,
					and(
						eq(playerTag.id, playerTagLink.tagId),
						eq(playerTag.userId, playerTagLink.userId)
					)
				)
				.where(
					and(
						eq(playerTagLink.userId, userId),
						inArray(playerTagLink.playerId, chunk)
					)
				)
				.orderBy(asc(playerTagLink.position), asc(playerTag.id)),
		1
	);
	const grouped = new Map<string, PlayerTagOutput[]>();
	for (const { playerId, ...tag } of links) {
		const tags = grouped.get(playerId) ?? [];
		tags.push(tag);
		grouped.set(playerId, tags);
	}
	return grouped;
}

function linkStatements(
	db: DbInstance,
	userId: string,
	playerId: string,
	tagIds: string[]
): BatchStatement[] {
	return insertChunks(
		tagIds.map((tagId, position) => ({ userId, playerId, tagId, position })),
		(chunk) => db.insert(playerTagLink).values(chunk)
	);
}

async function withTags<T extends { id: string }>(
	db: DbInstance,
	userId: string,
	row: T
): Promise<T & { tags: PlayerTagOutput[] }> {
	const tags = await tagsByPlayer(db, userId, [row.id]);
	return { ...row, tags: tags.get(row.id) ?? [] };
}

export const playerRouter = router({
	list: protectedProcedure
		.input(playerListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			let playerIds: string[] | undefined;

			if (input?.tagIds && input.tagIds.length > 0) {
				await validateTagsOwnership(ctx.db, playerTag, input.tagIds, userId);
				const tagLinks = await selectInChunks(
					input.tagIds,
					(chunk) =>
						ctx.db
							.select({ playerId: playerTagLink.playerId })
							.from(playerTagLink)
							.where(
								and(
									eq(playerTagLink.userId, userId),
									inArray(playerTagLink.tagId, chunk)
								)
							),
					1
				);
				playerIds = [...new Set(tagLinks.map((link) => link.playerId))];
				if (playerIds.length === 0) {
					return [];
				}
			}

			const conditions = [
				eq(player.userId, userId),
				eq(player.isTemporary, false),
				eq(player.isSelf, false),
			];
			if (input?.search) {
				conditions.push(
					sql`instr(lower(${player.name}), lower(${input.search})) > 0`
				);
			}

			const players = playerIds
				? await selectInChunks(
						playerIds,
						(chunk) =>
							ctx.db
								.select()
								.from(player)
								.where(and(...conditions, inArray(player.id, chunk))),
						conditions.length
					)
				: await ctx.db
						.select()
						.from(player)
						.where(and(...conditions));

			const uniquePlayers = [
				...new Map(players.map((item) => [item.id, item])).values(),
			];
			if (uniquePlayers.length === 0) {
				return [];
			}

			const tags = await tagsByPlayer(
				ctx.db,
				userId,
				uniquePlayers.map((item) => item.id)
			);
			return uniquePlayers.map((item) => ({
				...item,
				tags: tags.get(item.id) ?? [],
			}));
		}),

	getSelf: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		return withTags(ctx.db, userId, await ensureSelfPlayer(ctx.db, userId));
	}),

	getById: protectedProcedure
		.input(z.object({ id: idSchema }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateEntityOwnership(
				ctx.db,
				"player",
				input.id,
				userId
			);

			return withTags(ctx.db, userId, found);
		}),

	hands: protectedProcedure
		.input(playerHandsInputSchema)
		.query(({ ctx, input }) =>
			listPlayerHands(ctx.db, ctx.session.user.id, input)
		),

	handStats: protectedProcedure
		.input(playerHandStatsInputSchema)
		.query(({ ctx, input }) =>
			playerHandStats(ctx.db, ctx.session.user.id, input)
		),

	create: protectedProcedure
		.input(
			z.object({
				name: playerNameSchema,
				memo: memoSchema.optional(),
				tagIds: tagIdsSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTagsOwnership(ctx.db, playerTag, input.tagIds, userId);

			const id = crypto.randomUUID();
			await runBatch(ctx.db, [
				ctx.db.insert(player).values({
					id,
					userId,
					name: input.name,
					memo: input.memo ?? null,
					updatedAt: new Date(),
				}),
				...linkStatements(ctx.db, userId, id, input.tagIds ?? []),
			]);

			const [created] = await ctx.db
				.select()
				.from(player)
				.where(and(eq(player.id, id), eq(player.userId, userId)));
			if (!created) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
			}
			return withTags(ctx.db, userId, created);
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: idSchema,
				name: playerNameSchema.optional(),
				memo: memoSchema.optional().nullable(),
				tagIds: tagIdsSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "player", input.id, userId);

			await validateTagsOwnership(ctx.db, playerTag, input.tagIds, userId);

			const statements: BatchStatement[] = [];
			if (
				input.name !== undefined ||
				input.memo !== undefined ||
				input.tagIds !== undefined
			) {
				statements.push(
					ctx.db
						.update(player)
						.set({
							...(input.name === undefined ? {} : { name: input.name }),
							...(input.memo === undefined ? {} : { memo: input.memo }),
							updatedAt: new Date(),
						})
						.where(and(eq(player.id, input.id), eq(player.userId, userId)))
				);
			}

			if (input.tagIds !== undefined) {
				statements.push(
					ctx.db
						.delete(playerTagLink)
						.where(
							and(
								eq(playerTagLink.playerId, input.id),
								eq(playerTagLink.userId, userId)
							)
						),
					...linkStatements(ctx.db, userId, input.id, input.tagIds)
				);
			}

			await runBatch(ctx.db, statements);

			const [updated] = await ctx.db
				.select()
				.from(player)
				.where(and(eq(player.id, input.id), eq(player.userId, userId)));
			if (!updated) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
			}
			return withTags(ctx.db, userId, updated);
		}),

	delete: protectedProcedure
		.input(z.object({ id: idSchema }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "player", input.id, userId);

			const deleted = await ctx.db
				.delete(player)
				.where(
					and(
						eq(player.id, input.id),
						eq(player.userId, userId),
						eq(player.isSelf, false),
						not(
							exists(
								ctx.db
									.select({ playerId: handSeat.playerId })
									.from(handSeat)
									.where(
										and(
											eq(handSeat.playerId, input.id),
											eq(handSeat.userId, userId)
										)
									)
							)
						),
						not(
							exists(
								ctx.db
									.select({ id: playEvent.id })
									.from(playEvent)
									.where(
										and(
											eq(playEvent.userId, userId),
											inArray(playEvent.type, ["player_join", "player_leave"]),
											sql`json_extract(${playEvent.payload}, '$.playerId') = ${input.id}`
										)
									)
							)
						)
					)
				)
				.returning({ id: player.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This player cannot be deleted",
				});
			}
			return { success: true };
		}),
});
