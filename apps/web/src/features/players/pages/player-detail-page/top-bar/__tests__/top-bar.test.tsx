import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "@/features/players/pages/player-detail-page/top-bar";

const BACK_RE = /Back/i;

function renderTopBar(props: React.ComponentProps<typeof TopBar>) {
	const rootRoute = createRootRoute({
		component: () => <TopBar {...props} />,
	});
	const playersRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/players",
		component: () => <div>list</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([playersRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("TopBar", () => {
	it("renders a Back link to the players list", async () => {
		renderTopBar({});
		const link = await screen.findByRole("link", { name: BACK_RE });
		expect(link).toHaveAttribute("href", "/players");
	});

	it("omits the actions button when onOpenActions is not provided", async () => {
		renderTopBar({});
		await screen.findByRole("link", { name: BACK_RE });
		expect(
			screen.queryByRole("button", { name: "More actions" })
		).not.toBeInTheDocument();
	});

	it("renders the actions button when onOpenActions is provided", async () => {
		renderTopBar({ onOpenActions: vi.fn() });
		expect(
			await screen.findByRole("button", { name: "More actions" })
		).toBeInTheDocument();
	});

	it("calls onOpenActions when the actions button is clicked", async () => {
		const user = userEvent.setup();
		const onOpenActions = vi.fn();
		renderTopBar({ onOpenActions });
		await user.click(
			await screen.findByRole("button", { name: "More actions" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
	});
});
