import { DEFAULT_GAME_VARIANTS } from "@sapphire2/db/constants";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const blindLabelSchema = z.string().trim().min(1).max(20).nullable().optional();

async function validateGameVariantOwnership(
	db: DbInstance,
	id: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.id, id));

	// A row that doesn't exist and a row owned by someone else are
	// indistinguishable from the outside (a variant is per-user, never shared),
	// so both collapse into NOT_FOUND rather than leaking existence via
	// FORBIDDEN.
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Game variant not found",
		});
	}

	return found;
}

async function ensureNameAvailable(
	db: DbInstance,
	userId: string,
	name: string,
	excludeId?: string
) {
	const rows = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));

	const conflict = rows.some(
		(row) => row.id !== excludeId && row.name === name
	);

	if (conflict) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A game variant with this name already exists",
		});
	}
}

export const gameVariantRouter = router({
	list: protectedProcedure
		.input(z.object({ includeArchived: z.boolean().optional() }).optional())
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			let rows = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.userId, userId));

			if (rows.length === 0) {
				const seedRows = DEFAULT_GAME_VARIANTS.map((variant, index) => ({
					id: crypto.randomUUID(),
					userId,
					name: variant.name,
					blindLabel1: variant.blindLabel1,
					blindLabel2: variant.blindLabel2,
					blindLabel3: variant.blindLabel3,
					sortOrder: index,
				}));

				await ctx.db.insert(gameVariant).values(seedRows).onConflictDoNothing();

				rows = await ctx.db
					.select()
					.from(gameVariant)
					.where(eq(gameVariant.userId, userId));
			}

			const visible = input?.includeArchived
				? rows
				: rows.filter((row) => row.archivedAt == null);

			return [...visible].sort((a, b) => {
				if (a.sortOrder !== b.sortOrder) {
					return a.sortOrder - b.sortOrder;
				}
				return a.name.localeCompare(b.name);
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().trim().min(1).max(50),
				blindLabel1: blindLabelSchema,
				blindLabel2: blindLabelSchema,
				blindLabel3: blindLabelSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const existing = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.userId, userId));

			if (existing.some((row) => row.name === input.name)) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A game variant with this name already exists",
				});
			}

			const id = crypto.randomUUID();
			await ctx.db.insert(gameVariant).values({
				id,
				userId,
				name: input.name,
				blindLabel1: input.blindLabel1 ?? null,
				blindLabel2: input.blindLabel2 ?? null,
				blindLabel3: input.blindLabel3 ?? null,
				sortOrder: existing.length,
				updatedAt: new Date(),
			});

			const [created] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().trim().min(1).max(50).optional(),
				blindLabel1: blindLabelSchema,
				blindLabel2: blindLabelSchema,
				blindLabel3: blindLabelSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateGameVariantOwnership(
				ctx.db,
				input.id,
				userId
			);

			const nameChanged = input.name !== undefined && input.name !== found.name;

			if (nameChanged) {
				await ensureNameAvailable(
					ctx.db,
					userId,
					input.name as string,
					found.id
				);
			}

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.name !== undefined) {
				updateData.name = input.name;
			}
			if (input.blindLabel1 !== undefined) {
				updateData.blindLabel1 = input.blindLabel1;
			}
			if (input.blindLabel2 !== undefined) {
				updateData.blindLabel2 = input.blindLabel2;
			}
			if (input.blindLabel3 !== undefined) {
				updateData.blindLabel3 = input.blindLabel3;
			}

			if (nameChanged) {
				const newName = input.name as string;
				await ctx.db.batch([
					ctx.db
						.update(gameVariant)
						.set(updateData)
						.where(eq(gameVariant.id, input.id)),
					ctx.db
						.update(ringGame)
						.set({ variant: newName })
						.where(eq(ringGame.variantId, input.id)),
					ctx.db
						.update(tournament)
						.set({ variant: newName })
						.where(eq(tournament.variantId, input.id)),
				]);
			} else {
				await ctx.db
					.update(gameVariant)
					.set(updateData)
					.where(eq(gameVariant.id, input.id));
			}

			const [updated] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, input.id));
			return updated;
		}),

	archive: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateGameVariantOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(gameVariant)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(gameVariant.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, input.id));
			return updated;
		}),

	restore: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateGameVariantOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(gameVariant)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(eq(gameVariant.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateGameVariantOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(gameVariant).where(eq(gameVariant.id, input.id));
			return { success: true };
		}),
});
