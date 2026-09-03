import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

const writers = [
	["create", appRouter.currency.create, {}],
	["update", appRouter.currency.update, { id: "c1" }],
] as const;

describe("currency router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currency).sort()).toEqual(
			["create", "delete", "list", "toggleFavorite", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.currency, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			toggleFavorite: "mutation",
			update: "mutation",
		});
	});
});

describe("currency name validation", () => {
	it.each(writers)("%s rejects an empty name", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "" });
	});
});

describe("currency unit validation", () => {
	it.each(
		writers
	)("%s accepts a half-width unit of up to 4 characters", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "USD", unit: "$" });
		expectAccepts(procedure, { ...base, name: "Chips", unit: "CHIP" });
	});

	it.each(
		writers
	)("%s rejects a unit longer than 4 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "X", unit: "ABCDE" });
	});

	it.each(writers)("%s rejects a multi-byte unit", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "JPY", unit: "¥" });
		expectRejects(procedure, { ...base, name: "EUR", unit: "€" });
	});

	it("update accepts clearing the unit to null", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: null });
	});
});

describe("currency description validation", () => {
	it.each(
		writers
	)("%s accepts a description at the 50,000-character boundary", (_name, procedure, base) => {
		expectAccepts(procedure, {
			...base,
			name: "Chips",
			description: "a".repeat(50_000),
		});
	});

	it.each(
		writers
	)("%s rejects a description longer than 50,000 characters", (_name, procedure, base) => {
		expectRejects(procedure, {
			...base,
			name: "Chips",
			description: "a".repeat(50_001),
		});
	});

	it.each(
		writers
	)("%s accepts a null description", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "Chips", description: null });
	});
});
