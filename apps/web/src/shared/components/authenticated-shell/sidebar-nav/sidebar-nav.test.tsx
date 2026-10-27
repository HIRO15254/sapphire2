import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileNav } from "../mobile-nav";
import { SidebarNav } from "./sidebar-nav";

function createTestRouter(path: string) {
	const root = createRootRoute({
		component: () => (
			<>
				<MobileNav />
				<SidebarNav />
			</>
		),
	});
	const routes = ["/", "/settings"].map((routePath) =>
		createRoute({
			getParentRoute: () => root,
			path: routePath,
			component: () => null,
		})
	);
	return createRouter({
		history: createMemoryHistory({ initialEntries: [path] }),
		routeTree: root.addChildren(routes),
	});
}

describe("navigation", () => {
	it("identifies Home and the More and Settings destinations as current", async () => {
		const router = createTestRouter("/");
		render(<RouterProvider router={router} />);
		const mobile = await screen.findByRole("navigation", { name: "Primary" });
		const desktop = screen.getByRole("navigation", { name: "Main" });
		expect(within(mobile).getByRole("link", { name: "Home" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		await router.navigate({ to: "/settings" });
		expect(
			await within(mobile).findByRole("link", { name: "More", current: "page" })
		).toBeInTheDocument();
		expect(
			within(desktop).getByRole("link", { name: "Settings" })
		).toHaveAttribute("aria-current", "page");
	});
});
