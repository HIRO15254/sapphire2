import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { type BatchStatement, runBatch } from "../lib/batch";
import { optionalUniqueTagIdsSchema } from "../lib/tag-ids";
import {
	chunkForInsert,
	selectInChunks,
	validateTagsOwnership,
} from "./session";

export const playerRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					search: z.string().optional(),
					tagIds: z.array(z.string()).optional(),
				})
				.optional()
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			let playerIds: string[] | undefined;

			if (input?.tagIds && input.tagIds.length > 0) {
				await validateTagsOwnership(ctx.db, playerTag, input.tagIds, userId);
				const tagLinks = await selectInChunks(input.tagIds, (chunk) =>
					ctx.db
						.select({ playerId: playerToPlayerTag.playerId })
						.from(playerToPlayerTag)
						.where(inArray(playerToPlayerTag.playerTagId, chunk))
				);
				playerIds = [...new Set(tagLinks.map((link) => link.playerId))];
				if (playerIds.length === 0) {
					return [];
				}
			}

			const conditions = [
				eq(player.userId, userId),
				eq(player.isTemporary, false),
			];
			if (input?.search) {
				conditions.push(like(player.name, `%${input.search}%`));
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
			const allPlayerIds = uniquePlayers.map((item) => item.id);
			if (allPlayerIds.length === 0) {
				return [];
			}

			const tagLinks = await selectInChunks(
				allPlayerIds,
				(chunk) =>
					ctx.db
						.select({
							playerId: playerToPlayerTag.playerId,
							tagId: playerTag.id,
							tagName: playerTag.name,
							tagColor: playerTag.color,
						})
						.from(playerToPlayerTag)
						.innerJoin(
							playerTag,
							eq(playerToPlayerTag.playerTagId, playerTag.id)
						)
						.where(
							and(
								inArray(playerToPlayerTag.playerId, chunk),
								eq(playerTag.userId, userId)
							)
						)
						.orderBy(asc(playerToPlayerTag.position)),
				1
			);

			const tagsByPlayer = new Map<
				string,
				Array<{ id: string; name: string; color: string }>
			>();
			for (const link of tagLinks) {
				const tags = tagsByPlayer.get(link.playerId) ?? [];
				tags.push({
					id: link.tagId,
					name: link.tagName,
					color: link.tagColor,
				});
				tagsByPlayer.set(link.playerId, tags);
			}

			return uniquePlayers.map((item) => ({
				...item,
				tags: tagsByPlayer.get(item.id) ?? [],
			}));
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(player)
				.where(eq(player.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this player",
				});
			}

			const tagLinks = await ctx.db
				.select({
					tagId: playerTag.id,
					tagName: playerTag.name,
					tagColor: playerTag.color,
				})
				.from(playerToPlayerTag)
				.innerJoin(
					playerTag,
					and(
						eq(playerToPlayerTag.playerTagId, playerTag.id),
						eq(playerTag.userId, userId)
					)
				)
				.where(eq(playerToPlayerTag.playerId, found.id))
				.orderBy(asc(playerToPlayerTag.position));

			return {
				...found,
				tags: tagLinks.map((tag) => ({
					id: tag.tagId,
					name: tag.tagName,
					color: tag.tagColor,
				})),
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				memo: z.string().max(50_000).optional(),
				tagIds: optionalUniqueTagIdsSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTagsOwnership(ctx.db, playerTag, input.tagIds, userId);

			const id = crypto.randomUUID();
			const statements: BatchStatement[] = [
				ctx.db.insert(player).values({
					id,
					userId,
					name: input.name,
					memo: input.memo ?? null,
					updatedAt: new Date(),
				}),
			];

			if (input.tagIds && input.tagIds.length > 0) {
				const links = input.tagIds.map((tagId, position) => ({
					playerId: id,
					playerTagId: tagId,
					position,
				}));
				for (const chunk of chunkForInsert(links, 3)) {
					statements.push(ctx.db.insert(playerToPlayerTag).values(chunk));
				}
			}

			await runBatch(ctx.db, statements);

			const [created] = await ctx.db
				.select()
				.from(player)
				.where(eq(player.id, id));

			const tagLinks = await ctx.db
				.select({
					tagId: playerTag.id,
					tagName: playerTag.name,
					tagColor: playerTag.color,
				})
				.from(playerToPlayerTag)
				.innerJoin(
					playerTag,
					and(
						eq(playerToPlayerTag.playerTagId, playerTag.id),
						eq(playerTag.userId, userId)
					)
				)
				.where(eq(playerToPlayerTag.playerId, id))
				.orderBy(asc(playerToPlayerTag.position));

			return {
				...created,
				tags: tagLinks.map((tag) => ({
					id: tag.tagId,
					name: tag.tagName,
					color: tag.tagColor,
				})),
			};
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100).optional(),
				memo: z.string().max(50_000).optional().nullable(),
				tagIds: optionalUniqueTagIdsSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(player)
				.where(eq(player.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this player",
				});
			}

			if (input.tagIds !== undefined) {
				await validateTagsOwnership(ctx.db, playerTag, input.tagIds, userId);
			}

			const statements: BatchStatement[] = [
				ctx.db
					.update(player)
					.set({
						...(input.name === undefined ? {} : { name: input.name }),
						...(input.memo === undefined ? {} : { memo: input.memo }),
					})
					.where(eq(player.id, input.id)),
			];

			if (input.tagIds !== undefined) {
				statements.push(
					ctx.db
						.delete(playerToPlayerTag)
						.where(eq(playerToPlayerTag.playerId, input.id))
				);
				const links = input.tagIds.map((tagId, position) => ({
					playerId: input.id,
					playerTagId: tagId,
					position,
				}));
				for (const chunk of chunkForInsert(links, 3)) {
					statements.push(ctx.db.insert(playerToPlayerTag).values(chunk));
				}
			}

			await runBatch(ctx.db, statements);

			const [updated] = await ctx.db
				.select()
				.from(player)
				.where(eq(player.id, input.id));

			const tagLinks = await ctx.db
				.select({
					tagId: playerTag.id,
					tagName: playerTag.name,
					tagColor: playerTag.color,
				})
				.from(playerToPlayerTag)
				.innerJoin(
					playerTag,
					and(
						eq(playerToPlayerTag.playerTagId, playerTag.id),
						eq(playerTag.userId, userId)
					)
				)
				.where(eq(playerToPlayerTag.playerId, input.id))
				.orderBy(asc(playerToPlayerTag.position));

			return {
				...updated,
				tags: tagLinks.map((tag) => ({
					id: tag.tagId,
					name: tag.tagName,
					color: tag.tagColor,
				})),
			};
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(player)
				.where(eq(player.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this player",
				});
			}

			await ctx.db.delete(player).where(eq(player.id, input.id));
			return { success: true };
		}),
});
