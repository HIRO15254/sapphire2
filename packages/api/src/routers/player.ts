import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

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
				const tagLinks = await ctx.db
					.select({ playerId: playerToPlayerTag.playerId })
					.from(playerToPlayerTag)
					.where(inArray(playerToPlayerTag.playerTagId, input.tagIds));
				playerIds = [...new Set(tagLinks.map((l) => l.playerId))];
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
			if (playerIds) {
				conditions.push(inArray(player.id, playerIds));
			}

			const players = await ctx.db
				.select()
				.from(player)
				.where(and(...conditions));

			const allPlayerIds = players.map((p) => p.id);
			if (allPlayerIds.length === 0) {
				return [];
			}

			const tagLinks = await ctx.db
				.select({
					playerId: playerToPlayerTag.playerId,
					tagId: playerTag.id,
					tagName: playerTag.name,
					tagColor: playerTag.color,
				})
				.from(playerToPlayerTag)
				.innerJoin(playerTag, eq(playerToPlayerTag.playerTagId, playerTag.id))
				.where(inArray(playerToPlayerTag.playerId, allPlayerIds))
				.orderBy(asc(playerToPlayerTag.position));

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

			return players.map((p) => ({
				...p,
				tags: tagsByPlayer.get(p.id) ?? [],
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

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			if (found.userId !== userId) {
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
				.innerJoin(playerTag, eq(playerToPlayerTag.playerTagId, playerTag.id))
				.where(eq(playerToPlayerTag.playerId, found.id))
				.orderBy(asc(playerToPlayerTag.position));

			return {
				...found,
				tags: tagLinks.map((t) => ({
					id: t.tagId,
					name: t.tagName,
					color: t.tagColor,
				})),
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				memo: z.string().max(50_000).optional(),
				tagIds: z.array(z.string()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();

			await ctx.db.insert(player).values({
				id,
				userId,
				name: input.name,
				memo: input.memo ?? null,
				updatedAt: new Date(),
			});

			if (input.tagIds && input.tagIds.length > 0) {
				await ctx.db.insert(playerToPlayerTag).values(
					input.tagIds.map((tagId, index) => ({
						playerId: id,
						playerTagId: tagId,
						position: index,
					}))
				);
			}

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
				.innerJoin(playerTag, eq(playerToPlayerTag.playerTagId, playerTag.id))
				.where(eq(playerToPlayerTag.playerId, id))
				.orderBy(asc(playerToPlayerTag.position));

			return {
				...created,
				tags: tagLinks.map((t) => ({
					id: t.tagId,
					name: t.tagName,
					color: t.tagColor,
				})),
			};
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100).optional(),
				memo: z.string().max(50_000).optional().nullable(),
				tagIds: z.array(z.string()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(player)
				.where(eq(player.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this player",
				});
			}

			await ctx.db
				.update(player)
				.set({
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.memo === undefined ? {} : { memo: input.memo }),
				})
				.where(eq(player.id, input.id));

			if (input.tagIds !== undefined) {
				await ctx.db
					.delete(playerToPlayerTag)
					.where(eq(playerToPlayerTag.playerId, input.id));
				if (input.tagIds.length > 0) {
					await ctx.db.insert(playerToPlayerTag).values(
						input.tagIds.map((tagId, index) => ({
							playerId: input.id,
							playerTagId: tagId,
							position: index,
						}))
					);
				}
			}

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
				.innerJoin(playerTag, eq(playerToPlayerTag.playerTagId, playerTag.id))
				.where(eq(playerToPlayerTag.playerId, input.id))
				.orderBy(asc(playerToPlayerTag.position));

			return {
				...updated,
				tags: tagLinks.map((t) => ({
					id: t.tagId,
					name: t.tagName,
					color: t.tagColor,
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

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this player",
				});
			}

			await ctx.db.delete(player).where(eq(player.id, input.id));
			return { success: true };
		}),
});
