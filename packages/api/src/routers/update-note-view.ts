import { updateNoteView } from "@sapphire2/db/schema/update-note-view";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const updateNoteViewRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		return await ctx.db
			.select()
			.from(updateNoteView)
			.where(eq(updateNoteView.userId, userId))
			.orderBy(desc(updateNoteView.viewedAt));
	}),

	markViewed: protectedProcedure
		.input(z.object({ version: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const [existing] = await ctx.db
				.select()
				.from(updateNoteView)
				.where(
					and(
						eq(updateNoteView.userId, userId),
						eq(updateNoteView.version, input.version)
					)
				);

			if (existing) {
				return existing;
			}

			const id = crypto.randomUUID();
			await ctx.db
				.insert(updateNoteView)
				.values({ id, userId, version: input.version });

			const [created] = await ctx.db
				.select()
				.from(updateNoteView)
				.where(eq(updateNoteView.id, id));
			return created;
		}),

	getLatestViewedVersion: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const [latest] = await ctx.db
			.select()
			.from(updateNoteView)
			.where(eq(updateNoteView.userId, userId))
			.orderBy(desc(updateNoteView.viewedAt))
			.limit(1);

		if (!latest) {
			return { version: null, viewedAt: null };
		}

		return { version: latest.version, viewedAt: latest.viewedAt };
	}),
});
