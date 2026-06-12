import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@/features/statistics/pages/statistics-page", () => ({
	StatisticsPage: () => <div data-testid="statistics-page">StatisticsPage</div>,
}));

describe("StatisticsRoute", () => {
	it("wires StatisticsPage as the route component", async () => {
		const routeModule = await import("@/routes/statistics");
		expect(routeModule.Route.options.component).toBe(
			(await import("@/features/statistics/pages/statistics-page"))
				.StatisticsPage
		);
	});

	it("renders the StatisticsPage content when the route component is mounted", async () => {
		const routeModule = await import("@/routes/statistics");
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByTestId("statistics-page")).toBeInTheDocument();
	});
});
