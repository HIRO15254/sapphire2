import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "@/features/sessions/pages/session-detail-page/top-bar";

function renderTopBar(props: React.ComponentProps<typeof TopBar> = {}) {
	const rootRoute = createRootRoute({
		component: () => <TopBar {...props} />,
	});
	const listRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/sessions",
		component: () => <div>list</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([listRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("TopBar", () => {
	it("links Back to the sessions list", async () => {
		renderTopBar();
		const link = await screen.findByRole("link", { name: "Back" });
		expect(link).toHaveAttribute("href", "/sessions");
	});

	it("shows the actions button and fires onOpenActions when provided", async () => {
		const user = userEvent.setup();
		const onOpenActions = vi.fn();
		renderTopBar({ onOpenActions });
		await user.click(
			await screen.findByRole("button", { name: "More actions" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
	});

	it("hides the actions button when no handler is given", async () => {
		renderTopBar();
		await screen.findByRole("link", { name: "Back" });
		expect(
			screen.queryByRole("button", { name: "More actions" })
		).not.toBeInTheDocument();
	});
});
