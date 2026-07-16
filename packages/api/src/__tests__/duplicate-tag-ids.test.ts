import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { getInputSchema } from "./test-utils";

const TAG_IDS_UNIQUE_MESSAGE = "Tag IDs must be unique";

const writeCases = [
	{
		name: "player.create",
		procedure: appRouter.player.create,
		input: (tagIds?: string[]) => ({ name: "Alice", tagIds }),
		call: (
			caller: ReturnType<typeof appRouter.createCaller>,
			tagIds: string[]
		) => caller.player.create({ name: "Alice", tagIds }),
	},
	{
		name: "player.update",
		procedure: appRouter.player.update,
		input: (tagIds?: string[]) => ({ id: "player-1", tagIds }),
		call: (
			caller: ReturnType<typeof appRouter.createCaller>,
			tagIds: string[]
		) => caller.player.update({ id: "player-1", tagIds }),
	},
	{
		name: "session.create",
		procedure: appRouter.session.create,
		input: (tagIds?: string[]) => ({
			type: "cash_game" as const,
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			tagIds,
		}),
		call: (
			caller: ReturnType<typeof appRouter.createCaller>,
			tagIds: string[]
		) =>
			caller.session.create({
				type: "cash_game",
				sessionDate: 1_700_000_000,
				buyIn: 1000,
				cashOut: 2000,
				tagIds,
			}),
	},
	{
		name: "session.update",
		procedure: appRouter.session.update,
		input: (tagIds?: string[]) => ({ id: "session-1", tagIds }),
		call: (
			caller: ReturnType<typeof appRouter.createCaller>,
			tagIds: string[]
		) => caller.session.update({ id: "session-1", tagIds }),
	},
] as const;

describe("unique tagIds input contract (SA2-210)", () => {
	it.each(
		writeCases
	)("$name accepts omitted, empty, single, and ordered distinct IDs", ({
		input,
		procedure,
	}) => {
		const schema = getInputSchema(procedure);
		for (const tagIds of [
			undefined,
			[],
			["tag-1"],
			["tag-1", "tag-2"],
			["tag-2", "tag-1"],
		] as const) {
			expect(schema.safeParse(input(tagIds && [...tagIds])).success).toBe(true);
		}
	});

	it.each(
		writeCases.flatMap((writeCase) => [
			{ ...writeCase, duplicateKind: "adjacent", tagIds: ["tag-1", "tag-1"] },
			{
				...writeCase,
				duplicateKind: "non-adjacent",
				tagIds: ["tag-1", "tag-2", "tag-1"],
			},
		])
	)("$name rejects $duplicateKind duplicates with the stable message", ({
		input,
		procedure,
		tagIds,
	}) => {
		const result = getInputSchema(procedure).safeParse(input(tagIds)) as {
			error?: { issues: Array<{ message: string; path: PropertyKey[] }> };
			success: boolean;
		};
		expect(result.success).toBe(false);
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({
				message: TAG_IDS_UNIQUE_MESSAGE,
				path: ["tagIds"],
			})
		);
	});

	it.each(
		writeCases
	)("$name rejects duplicates before ownership checks or writes", async ({
		call,
	}) => {
		const dbRead = vi.fn(() => {
			throw new Error("DB must not be accessed for invalid input");
		});
		const db = new Proxy({}, { get: dbRead });
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as never);

		try {
			await call(caller, ["tag-1", "tag-1"]);
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect(error).toMatchObject({ code: "BAD_REQUEST" });
			expect((error as Error).message).toContain(TAG_IDS_UNIQUE_MESSAGE);
			expect(dbRead).toHaveBeenCalledTimes(0);
			return;
		}
		throw new Error("expected duplicate tagIds to be rejected");
	});
});
