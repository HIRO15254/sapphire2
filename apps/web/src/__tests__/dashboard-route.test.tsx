import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@/features/dashboard/components/dashboard-page", () => ({
	DashboardPage: () => <div data-testid="dashboard-page">DashboardPage</div>,
}));

describe("DashboardRoute", () => {
	it("wires DashboardPage as the route component", async () => {
		const routeModule = await import("@/routes/dashboard");
		expect(routeModule.Route.options.component).toBe(
			(await import("@/features/dashboard/components/dashboard-page"))
				.DashboardPage
		);
	});

	it("renders the DashboardPage content when the route component is mounted", async () => {
		const routeModule = await import("@/routes/dashboard");
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
	});
});
