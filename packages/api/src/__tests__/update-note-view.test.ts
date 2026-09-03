import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

describe("updateNoteView.markViewed concurrency", () => {
	it("lets simultaneous writes converge on one row", async () => {
		const rows: Record<string, unknown>[] = [];
		let conflictCalls = 0;
		const makeSelectChain = () => {
			const chain = Promise.resolve([...rows]) as Promise<
				Record<string, unknown>[]
			> &
				Record<string, (...args: unknown[]) => unknown>;
			chain.where = () => chain;
			chain.orderBy = () => chain;
			return chain;
		};
		const db = {
			select: () => ({ from: () => makeSelectChain() }),
			insert: () => ({
				values: (values: Record<string, unknown>) => ({
					onConflictDoNothing: () => {
						conflictCalls += 1;
						const alreadyExists = rows.some(
							(row) =>
								row.userId === values.userId && row.version === values.version
						);
						if (!alreadyExists) {
							rows.push(values);
						}
						return Promise.resolve();
					},
				}),
			}),
		};
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		const [first, second] = await Promise.all([
			caller.updateNoteView.markViewed({ version: "1.2.3" }),
			caller.updateNoteView.markViewed({ version: "1.2.3" }),
		]);

		expect(first).toMatchObject({ userId: "user-1", version: "1.2.3" });
		expect(second).toEqual(first);
		expect(rows).toHaveLength(1);
		expect(conflictCalls).toBe(2);
	});
});

describe("updateNoteView router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.updateNoteView).sort()).toEqual(
			["list", "markViewed"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.updateNoteView, {
			list: "query",
			markViewed: "mutation",
		});
	});
});

describe("updateNoteView.markViewed input validation", () => {
	it("accepts a non-empty version string", () => {
		expectAccepts(appRouter.updateNoteView.markViewed, { version: "1.2.3" });
	});

	it("rejects empty version", () => {
		expectRejects(appRouter.updateNoteView.markViewed, { version: "" });
	});
});
