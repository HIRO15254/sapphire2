import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { todo } from "../schema/todo";

describe("todo schema", () => {
	it("has expected columns", () => {
		const columns = getTableColumns(todo);
		expect(columns).toHaveProperty("id");
		expect(columns).toHaveProperty("text");
		expect(columns).toHaveProperty("completed");
	});

	it("has id as primary key", () => {
		const columns = getTableColumns(todo);
		expect(columns.id.primary).toBe(true);
	});

	it("has text as not null", () => {
		const columns = getTableColumns(todo);
		expect(columns.text.notNull).toBe(true);
	});

	it("has completed defaulting to false", () => {
		const columns = getTableColumns(todo);
		expect(columns.completed.notNull).toBe(true);
		expect(columns.completed.hasDefault).toBe(true);
	});
});
