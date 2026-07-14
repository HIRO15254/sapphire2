import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@/features/games/pages/games-page", () => ({
	GamesPage: () => <div data-testid="games-page">GamesPage</div>,
}));

describe("GamesRoute", () => {
	it("wires GamesPage as the route component", async () => {
		const routeModule = await import("@/routes/games");
		expect(routeModule.Route.options.component).toBe(
			(await import("@/features/games/pages/games-page")).GamesPage
		);
	});

	it("renders the GamesPage content when the route component is mounted", async () => {
		const routeModule = await import("@/routes/games");
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByTestId("games-page")).toBeInTheDocument();
	});
});
