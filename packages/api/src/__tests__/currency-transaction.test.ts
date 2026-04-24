import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("currencyTransaction router structure", () => {
	it("appRouter has currencyTransaction namespace", () => {
		expect(appRouter.currencyTransaction).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currencyTransaction).sort()).toEqual(
			["create", "delete", "listByCurrency", "update"].sort()
		);
	});

	it("listByCurrency is a protected query", () => {
		expectProtected(appRouter.currencyTransaction.listByCurrency);
		expectType(appRouter.currencyTransaction.listByCurrency, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.currencyTransaction.create,
			appRouter.currencyTransaction.update,
			appRouter.currencyTransaction.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("currencyTransaction.listByCurrency input validation", () => {
	it("accepts a currencyId without cursor", () => {
		expectAccepts(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
		});
	});

	it("accepts currencyId with cursor", () => {
		expectAccepts(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
			cursor: "tx-42",
		});
	});

	it("rejects missing currencyId", () => {
		expectRejects(appRouter.currencyTransaction.listByCurrency, {});
	});

	it("rejects non-string cursor", () => {
		expectRejects(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
			cursor: 123,
		});
	});
});

describe("currencyTransaction.create input validation", () => {
	const validInput = {
		currencyId: "c1",
		transactionTypeId: "tt1",
		amount: 1000,
		transactedAt: "2024-01-01T00:00:00Z",
	};

	it("accepts the minimal valid payload", () => {
		expectAccepts(appRouter.currencyTransaction.create, validInput);
	});

	it("accepts an optional memo string", () => {
		expectAccepts(appRouter.currencyTransaction.create, {
			...validInput,
			memo: "rebuy",
		});
	});

	it("accepts negative amounts (expense / loss)", () => {
		expectAccepts(appRouter.currencyTransaction.create, {
			...validInput,
			amount: -500,
		});
	});

	it("rejects non-integer amount", () => {
		expectRejects(appRouter.currencyTransaction.create, {
			...validInput,
			amount: 12.5,
		});
	});

	it("rejects missing currencyId", () => {
		expectRejects(appRouter.currencyTransaction.create, {
			transactionTypeId: "tt1",
			amount: 100,
			transactedAt: "2024-01-01T00:00:00Z",
		});
	});

	it("rejects missing transactedAt", () => {
		expectRejects(appRouter.currencyTransaction.create, {
			currencyId: "c1",
			transactionTypeId: "tt1",
			amount: 100,
		});
	});
});

describe("currencyTransaction.update input validation", () => {
	it("accepts id-only payload (no-op update)", () => {
		expectAccepts(appRouter.currencyTransaction.update, { id: "tx1" });
	});

	it("accepts all optional fields set", () => {
		expectAccepts(appRouter.currencyTransaction.update, {
			id: "tx1",
			transactionTypeId: "tt2",
			amount: -200,
			transactedAt: "2024-02-02T00:00:00Z",
			memo: "adjusted",
		});
	});

	it("accepts memo: null (explicit clear)", () => {
		expectAccepts(appRouter.currencyTransaction.update, {
			id: "tx1",
			memo: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currencyTransaction.update, { amount: 100 });
	});

	it("rejects non-integer amount", () => {
		expectRejects(appRouter.currencyTransaction.update, {
			id: "tx1",
			amount: 12.34,
		});
	});
});

describe("currencyTransaction.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currencyTransaction.delete, { id: "tx1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currencyTransaction.delete, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currencyTransaction.delete, { id: 123 });
	});
});
