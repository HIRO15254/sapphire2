import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

function makeRouter(initialEntries: string[]) {
	const root = createRootRoute({ component: () => <Outlet /> });
	const list = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <div>List</div>,
	});
	const detail = createRoute({
		getParentRoute: () => root,
		path: "/settings",
		component: () => <PageHeader back={{ fallbackTo: "/" }} heading="Detail" />,
	});
	return createRouter({
		history: createMemoryHistory({ initialEntries }),
		routeTree: root.addChildren([list, detail]),
	});
}

describe("PageHeader back", () => {
	it("restores the previous entry including search, or uses the fallback on a cold entry", async () => {
		const user = userEvent.setup();
		const router = makeRouter(["/?filter=active", "/settings"]);
		const view = render(<RouterProvider router={router} />);
		await user.click(await screen.findByRole("button", { name: "Back" }));
		await waitFor(() =>
			expect(router.state.location.href).toBe("/?filter=active")
		);
		view.unmount();
		const coldRouter = makeRouter(["/settings"]);
		render(<RouterProvider router={coldRouter} />);
		await user.click(await screen.findByRole("button", { name: "Back" }));
		await waitFor(() => expect(coldRouter.state.location.pathname).toBe("/"));
	});
});
