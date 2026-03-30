import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileNav } from "../components/mobile-nav";

function createTestRouter(initialPath: string) {
	const rootRoute = createRootRoute({
		component: () => <MobileNav />,
	});

	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <div>Home</div>,
	});

	const dashboardRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/dashboard",
		component: () => <div>Dashboard</div>,
	});

	const storesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/stores",
		component: () => <div>Stores</div>,
	});

	const currenciesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/currencies",
		component: () => <div>Currencies</div>,
	});

	const sessionsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/sessions",
		component: () => <div>Sessions</div>,
	});

	const liveSessionsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/live-sessions",
		component: () => <div>Live</div>,
	});

	const playersRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/players",
		component: () => <div>Players</div>,
	});

	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		component: () => <div>Settings</div>,
	});

	const routeTree = rootRoute.addChildren([
		indexRoute,
		dashboardRoute,
		storesRoute,
		currenciesRoute,
		sessionsRoute,
		liveSessionsRoute,
		playersRoute,
		settingsRoute,
	]);

	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [initialPath] }),
	});
}

describe("MobileNav", () => {
	it("renders 7 navigation items", async () => {
		const router = createTestRouter("/");
		render(<RouterProvider router={router} />);

		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(7);
	});

	it("displays labels for all navigation items", async () => {
		const router = createTestRouter("/dashboard");
		render(<RouterProvider router={router} />);

		await screen.findByText("Dashboard");
		expect(screen.getByText("Stores")).toBeInTheDocument();
		expect(screen.getByText("Currencies")).toBeInTheDocument();
		expect(screen.getByText("Sessions")).toBeInTheDocument();
		expect(screen.getByText("Live")).toBeInTheDocument();
		expect(screen.getByText("Players")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("highlights the active navigation item for dashboard", async () => {
		const router = createTestRouter("/dashboard");
		render(<RouterProvider router={router} />);

		const dashboardLink = await screen.findByText("Dashboard");
		const link = dashboardLink.closest("a");
		expect(link?.className).toContain("text-sidebar-primary");
	});

	it("does not highlight inactive navigation items", async () => {
		const router = createTestRouter("/dashboard");
		render(<RouterProvider router={router} />);

		await screen.findByText("Dashboard");
		const storesLink = screen.getByText("Stores");
		const storesAnchor = storesLink.closest("a");
		expect(storesAnchor?.className).toContain("text-sidebar-foreground");
	});
});
