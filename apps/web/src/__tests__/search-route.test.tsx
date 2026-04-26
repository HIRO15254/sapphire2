import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

let routeModule: typeof import("@/routes/search");

describe("SearchRoute", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/search");
	});

	it("renders the page header and placeholder state", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByRole("heading", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByText("Availability")).toBeInTheDocument();
		expect(screen.getByText("Coming soon.")).toBeInTheDocument();
	});

	it("describes the search page purpose in the header", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByText("Search across your data will live here.")
		).toBeInTheDocument();
	});

	it("explains that the page is reserved for app-wide search", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByText("This page is reserved for app-wide search.")
		).toBeInTheDocument();
	});
});
