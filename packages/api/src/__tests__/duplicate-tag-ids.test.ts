import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { getInputSchema } from "./test-utils";

const writeCases = [
	{
		call: (
			caller: ReturnType<typeof appRouter.createCaller>,
			tagIds: string[]
		) => caller.player.create({ name: "Alice", tagIds }),
		input: (tagIds?: string[]) => ({ name: "Alice", tagIds }),
		name: "player.create",
		procedure: appRouter.player.create,
	},
	{
		call: (
			caller: ReturnType<typeof appRouter.createCaller>,
			tagIds: string[]
		) => caller.player.update({ id: "player-1", tagIds }),
		input: (tagIds?: string[]) => ({ id: "player-1", tagIds }),
		name: "player.update",
		procedure: appRouter.player.update,
	},
] as const;

describe("unique tagIds input contract (SA2-210)", () => {
	it.each(writeCases)(
		"$name accepts omitted, empty, single, and ordered distinct IDs",
		({ input, procedure }) => {
			const schema = getInputSchema(procedure);
			for (const tagIds of [
				undefined,
				[],
				["tag-1"],
				["tag-1", "tag-2"],
				["tag-2", "tag-1"],
			] as const) {
				expect(schema.safeParse(input(tagIds && [...tagIds])).success).toBe(
					true
				);
			}
		}
	);

	it.each(
		writeCases.flatMap((writeCase) => [
			{ ...writeCase, duplicateKind: "adjacent", tagIds: ["tag-1", "tag-1"] },
			{
				...writeCase,
				duplicateKind: "non-adjacent",
				tagIds: ["tag-1", "tag-2", "tag-1"],
			},
		])
	)(
		"$name rejects $duplicateKind duplicates",
		({ input, procedure, tagIds }) => {
			const result = getInputSchema(procedure).safeParse(input(tagIds)) as {
				error?: { issues: Array<{ message: string; path: PropertyKey[] }> };
				success: boolean;
			};
			expect(result.success).toBe(false);
		}
	);

	it.each(writeCases)(
		"$name rejects duplicates before ownership checks or writes",
		async ({ call }) => {
			const dbRead = vi.fn(() => {
				throw new Error("DB must not be accessed for invalid input");
			});
			const db = new Proxy({}, { get: dbRead });
			const caller = appRouter.createCaller({
				db,
				session: { user: { id: "user-1" } },
			} as never);

			try {
				await call(caller, ["tag-1", "tag-1"]);
			} catch (error) {
				expect(error).toBeInstanceOf(TRPCError);
				expect(error).toMatchObject({ code: "BAD_REQUEST" });
				expect(dbRead).toHaveBeenCalledTimes(0);
				return;
			}
			throw new Error("expected duplicate tagIds to be rejected");
		}
	);
});
