import { describe, expect, it, vi } from "vitest";

vi.mock("@my-better-t-app/db", () => ({
	createDb: vi.fn(),
}));

const { todoRouter } = await import("../routers/todo");

describe("todoRouter", () => {
	it("has getAll procedure", () => {
		expect(todoRouter).toHaveProperty("getAll");
	});

	it("has create procedure", () => {
		expect(todoRouter).toHaveProperty("create");
	});

	it("has toggle procedure", () => {
		expect(todoRouter).toHaveProperty("toggle");
	});

	it("has delete procedure", () => {
		expect(todoRouter).toHaveProperty("delete");
	});
});
