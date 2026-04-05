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
});
