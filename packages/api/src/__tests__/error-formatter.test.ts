import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { expect, it } from "vitest";
import type { Context } from "../context";
import { publicProcedure, router } from "../index";

it("hides unexpected error details from HTTP clients while preserving deliberate errors", async () => {
	const testRouter = router({
		unexpected: publicProcedure.query(() => {
			throw new Error("database secret");
		}),
		deliberate: publicProcedure.query(() => {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Service unavailable",
			});
		}),
	});
	async function request(path: string) {
		const response = await fetchRequestHandler({
			endpoint: "/trpc",
			req: new Request(`http://localhost/trpc/${path}`),
			router: testRouter,
			createContext: () => ({}) as Context,
		});
		return (await response.json()) as {
			error: { message: string; data: { stack?: string } };
		};
	}
	const unexpected = await request("unexpected");
	expect(unexpected.error.message).toBe("Internal server error");
	expect(unexpected.error.data.stack).toBeUndefined();
	expect((await request("deliberate")).error.message).toBe(
		"Service unavailable"
	);
});
