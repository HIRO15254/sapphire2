import { todo } from "@my-better-t-app/db/schema/todo";
import { eq } from "drizzle-orm";
import z from "zod";

import { publicProcedure, router } from "../index";

export const todoRouter = router({
	getAll: publicProcedure.query(async ({ ctx }) => {
		return await ctx.db.select().from(todo);
	}),

	create: publicProcedure
		.input(z.object({ text: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.insert(todo).values({
				text: input.text,
			});
		}),

	toggle: publicProcedure
		.input(z.object({ id: z.number(), completed: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db
				.update(todo)
				.set({ completed: input.completed })
				.where(eq(todo.id, input.id));
		}),

	delete: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.delete(todo).where(eq(todo.id, input.id));
		}),
});
