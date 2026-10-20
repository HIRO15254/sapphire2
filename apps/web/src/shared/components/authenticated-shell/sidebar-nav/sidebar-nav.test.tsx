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

	const routes = ["/", "/settings"].map((path) =>
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
		const router = createTestRouter("/settings");
		render(<RouterProvider router={router} />);

		expect(await screen.findByText("Home")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("User Menu")).toBeInTheDocument();
		expect(screen.getByText("Mode Toggle")).toBeInTheDocument();
	});

	it("announces the active item as the current page", async () => {
		const router = createTestRouter("/settings");
		render(<RouterProvider router={router} />);

		const settingsLink = await screen.findByText("Settings");
		expect(settingsLink.closest("a")).toHaveAttribute("aria-current", "page");
		expect(screen.getByText("Home").closest("a")).not.toHaveAttribute(
			"aria-current"
		);
	});
});
