import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileNav } from "./mobile-nav";

function createTestRouter(path: string) {
	const root = createRootRoute({ component: MobileNav });
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

describe("MobileNav", () => {
	it("marks Home on / and More on a destination reached through More", async () => {
		const router = createTestRouter("/");
		render(<RouterProvider router={router} />);
		expect(
			await screen.findByRole("link", { name: "Home", current: "page" })
		).toBeInTheDocument();
		await router.navigate({ to: "/settings" });
		expect(
			await screen.findByRole("link", { name: "More", current: "page" })
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
			"aria-current"
		);
	});
});
