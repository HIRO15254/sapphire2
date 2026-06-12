import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNav } from "./sidebar-nav";

vi.mock(
	"@/shared/components/authenticated-shell/sidebar-nav/user-menu",
	() => ({
		UserMenu: () => <div>User Menu</div>,
		default: () => <div>User Menu</div>,
	})
);

vi.mock(
	"@/shared/components/authenticated-shell/sidebar-nav/mode-toggle",
	() => ({
		ModeToggle: () => <div>Mode Toggle</div>,
	})
);

function createTestRouter(initialPath: string) {
	const rootRoute = createRootRoute({
		component: () => <SidebarNav />,
	});

	const routes = [
		"/statistics",
		"/sessions",
		"/rooms",
		"/players",
		"/currencies",
		"/settings",
	].map((path) =>
		createRoute({
			component: () => <div>{path}</div>,
			getParentRoute: () => rootRoute,
			path,
		})
	);

	return createRouter({
		history: createMemoryHistory({ initialEntries: [initialPath] }),
		routeTree: rootRoute.addChildren(routes),
	});
}

describe("SidebarNav", () => {
	it("renders shared navigation items and footer controls", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		expect(await screen.findByText("Sessions")).toBeInTheDocument();
		expect(screen.getByText("Statistics")).toBeInTheDocument();
		expect(screen.getByText("Rooms")).toBeInTheDocument();
		expect(screen.getByText("Players")).toBeInTheDocument();
		expect(screen.getByText("Currencies")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("User Menu")).toBeInTheDocument();
		expect(screen.getByText("Mode Toggle")).toBeInTheDocument();
	});

	it("highlights the active item", async () => {
		const router = createTestRouter("/rooms");
		render(<RouterProvider router={router} />);

		const roomsLink = await screen.findByText("Rooms");
		expect(roomsLink.closest("a")?.className).toContain("text-sidebar-primary");
	});
});
