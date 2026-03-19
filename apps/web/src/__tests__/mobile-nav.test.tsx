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

	const searchRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/search",
		component: () => <div>Search</div>,
	});

	const settingsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		component: () => <div>Settings</div>,
	});

	const routeTree = rootRoute.addChildren([
		indexRoute,
		dashboardRoute,
		searchRoute,
		settingsRoute,
	]);

	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [initialPath] }),
	});
}

describe("MobileNav", () => {
	it("renders 4 navigation items", async () => {
		const router = createTestRouter("/");
		render(<RouterProvider router={router} />);

		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(4);
	});

	it("displays labels for all navigation items", async () => {
		const router = createTestRouter("/");
		render(<RouterProvider router={router} />);

		await screen.findByText("Home");
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("Search")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("highlights the active navigation item for home", async () => {
		const router = createTestRouter("/");
		render(<RouterProvider router={router} />);

		const homeLink = await screen.findByText("Home");
		const link = homeLink.closest("a");
		expect(link?.className).toContain("text-sidebar-primary");
	});

	it("highlights the active navigation item for dashboard", async () => {
		const router = createTestRouter("/dashboard");
		render(<RouterProvider router={router} />);

		const dashboardLink = await screen.findByText("Dashboard");
		const link = dashboardLink.closest("a");
		expect(link?.className).toContain("text-sidebar-primary");

		const homeLink = screen.getByText("Home");
		const homeAnchor = homeLink.closest("a");
		expect(homeAnchor?.className).toContain("text-sidebar-foreground");
	});
});
