import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "../top-bar";

const BACK_RE = /Back/;

function renderTopBar(onOpenActions?: () => void) {
	const rootRoute = createRootRoute({
		component: () => <TopBar onOpenActions={onOpenActions} />,
	});
	const roomsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/rooms",
		component: () => <div>rooms</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([roomsRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("RoomDetail TopBar", () => {
	it("links Back to the rooms list", async () => {
		renderTopBar();
		const link = await screen.findByRole("link", { name: BACK_RE });
		expect(link).toHaveAttribute("href", "/rooms");
	});

	it("renders the actions button and calls onOpenActions when clicked", async () => {
		const user = userEvent.setup();
		const onOpenActions = vi.fn();
		renderTopBar(onOpenActions);
		await user.click(
			await screen.findByRole("button", { name: "More actions" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
	});

	it("omits the actions button when no handler is provided", async () => {
		renderTopBar();
		await screen.findByRole("link", { name: BACK_RE });
		expect(
			screen.queryByRole("button", { name: "More actions" })
		).not.toBeInTheDocument();
	});
});
