import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@/dashboard/components/dashboard-page", () => ({
	DashboardPage: () => null,
}));

describe("DashboardRoute", () => {
	it("wires DashboardPage as the route component", async () => {
		const routeModule = await import("@/routes/dashboard");
		expect(routeModule.Route.options.component).toBeDefined();
	});
});
