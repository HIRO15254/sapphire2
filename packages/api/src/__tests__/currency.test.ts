import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

describe("currency.create input validation", () => {
	it("accepts minimal payload (name only)", () => {
		expectAccepts(appRouter.currency.create, { name: "JPY" });
	});

	it("accepts optional half-width unit (≤4 chars)", () => {
		expectAccepts(appRouter.currency.create, { name: "USD", unit: "$" });
		expectAccepts(appRouter.currency.create, { name: "JPY", unit: "JPY" });
		expectAccepts(appRouter.currency.create, { name: "Chips", unit: "PT" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.currency.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.currency.create, {});
	});

	it("rejects non-string name", () => {
		expectRejects(appRouter.currency.create, { name: 123 });
	});

	it("rejects unit longer than 4 characters", () => {
		expectRejects(appRouter.currency.create, { name: "X", unit: "ABCDE" });
	});

	it("rejects multi-byte unit (full-width / non-ASCII)", () => {
		expectRejects(appRouter.currency.create, { name: "JPY", unit: "¥" });
		expectRejects(appRouter.currency.create, { name: "EUR", unit: "€" });
	});

	it("accepts an optional rich-text description", () => {
		expectAccepts(appRouter.currency.create, {
			name: "Chips",
			description: "<p>Weekday game chips</p>",
		});
	});

	it("accepts a null description (no description set)", () => {
		expectAccepts(appRouter.currency.create, {
			name: "Chips",
			description: null,
		});
	});

	it("accepts a description at the 50,000-character boundary", () => {
		expectAccepts(appRouter.currency.create, {
			name: "Chips",
			description: "a".repeat(50_000),
		});
	});

	it("rejects a description longer than 50,000 characters", () => {
		expectRejects(appRouter.currency.create, {
			name: "Chips",
			description: "a".repeat(50_001),
		});
	});
});

describe("currency.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.currency.update, { id: "c1" });
	});

	it("accepts id + name", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", name: "USD" });
	});

	it("accepts id + unit", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: "$" });
	});

	it("accepts unit cleared to null", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: null });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.currency.update, { id: "c1", name: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.update, { name: "USD" });
	});

	it("rejects unit longer than 4 characters", () => {
		expectRejects(appRouter.currency.update, { id: "c1", unit: "ABCDE" });
	});

	it("rejects multi-byte unit", () => {
		expectRejects(appRouter.currency.update, { id: "c1", unit: "¥" });
	});

	it("accepts id + description", () => {
		expectAccepts(appRouter.currency.update, {
			id: "c1",
			description: "<p>Updated</p>",
		});
	});

	it("accepts id + null description (clearing it)", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", description: null });
	});

	it("rejects a description longer than 50,000 characters", () => {
		expectRejects(appRouter.currency.update, {
			id: "c1",
			description: "a".repeat(50_001),
		});
	});
});

describe("currency.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currency.delete, { id: "c1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.delete, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currency.delete, { id: 42 });
	});
});

describe("currency.toggleFavorite input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currency.toggleFavorite, { id: "c1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.toggleFavorite, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currency.toggleFavorite, { id: 42 });
	});
});
