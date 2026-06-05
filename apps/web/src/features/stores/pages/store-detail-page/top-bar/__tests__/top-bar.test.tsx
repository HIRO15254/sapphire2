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
	const storesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/stores",
		component: () => <div>stores</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([storesRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("StoreDetail TopBar", () => {
	it("links Back to the stores list", async () => {
		renderTopBar();
		const link = await screen.findByRole("link", { name: BACK_RE });
		expect(link).toHaveAttribute("href", "/stores");
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
