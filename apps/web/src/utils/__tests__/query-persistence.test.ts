import type { Query } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { shouldPersistQuery } from "@/utils/query-persistence";

function queryWithStatus(status: "error" | "pending" | "success"): Query {
	return { state: { status } } as Query;
}

describe("shouldPersistQuery", () => {
	it("persists successful queries", () => {
		expect(shouldPersistQuery(queryWithStatus("success"))).toBe(true);
	});

	it("does not persist pending queries", () => {
		expect(shouldPersistQuery(queryWithStatus("pending"))).toBe(false);
	});

	it("does not persist failed queries", () => {
		expect(shouldPersistQuery(queryWithStatus("error"))).toBe(false);
	});
});
