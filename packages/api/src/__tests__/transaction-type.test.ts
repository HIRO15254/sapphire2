import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
} from "./test-utils";

function expectReservedNameRejection(
	procedure: unknown,
	input: Record<string, unknown>
) {
	const result = getInputSchema(procedure).safeParse(input);
	expect(result.success).toBe(false);
	if (result.success) {
		return;
	}
	expect(result.error.issues).toEqual([
		expect.objectContaining({
			path: ["name"],
			message: "Session Result is reserved",
		}),
	]);
}

describe("transactionType router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.transactionType).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.transactionType, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("transactionType.create input validation", () => {
	it("accepts a non-empty name", () => {
		expectAccepts(appRouter.transactionType.create, { name: "Bonus" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.transactionType.create, { name: "" });
	});

	it.each([
		"Session Result",
		"session result",
		"SeSsIoN ReSuLt",
		" Session Result ",
	])("rejects the reserved name %j before the mutation runs", (name) => {
		expectReservedNameRejection(appRouter.transactionType.create, { name });
	});
});

describe("transactionType.update input validation", () => {
	it("accepts {id, name}", () => {
		expectAccepts(appRouter.transactionType.update, {
			id: "tt1",
			name: "Renamed",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.transactionType.update, {
			id: "tt1",
			name: "",
		});
	});

	it("rejects missing name (required here unlike tag routers)", () => {
		expectRejects(appRouter.transactionType.update, { id: "tt1" });
	});

	it.each([
		"Session Result",
		"session result",
		"SeSsIoN ReSuLt",
		" Session Result ",
	])("rejects renaming to the reserved name %j before the mutation runs", (name) => {
		expectReservedNameRejection(appRouter.transactionType.update, {
			id: "tt1",
			name,
		});
	});
});
