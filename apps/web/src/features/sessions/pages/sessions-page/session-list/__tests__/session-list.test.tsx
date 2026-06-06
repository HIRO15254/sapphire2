import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionList } from "@/features/sessions/pages/sessions-page/session-list";
import type { SessionListCardItem } from "@/features/sessions/pages/sessions-page/session-list-card";

function makeSession(
	overrides: Partial<SessionListCardItem> & { id: string }
): SessionListCardItem {
	return {
		currencyUnit: null,
		profitLoss: 0,
		ringGameName: "1/2 NLH",
		roomName: null,
		sessionDate: "2026-01-15",
		source: "manual",
		tags: [],
		tournamentName: null,
		type: "cash_game",
		...overrides,
	};
}

function renderList(props: React.ComponentProps<typeof SessionList>) {
	const rootRoute = createRootRoute({
		component: () => <SessionList {...props} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/sessions/$sessionId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("SessionList", () => {
	it("renders the skeleton while loading and no rows", async () => {
		renderList({ isLoading: true, onCreate: vi.fn(), sessions: [] });
		expect(
			await screen.findByTestId("session-list-skeleton")
		).toBeInTheDocument();
		expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
	});

	it("renders the empty state when not loading and no sessions", async () => {
		renderList({ isLoading: false, onCreate: vi.fn(), sessions: [] });
		expect(await screen.findByText("No sessions yet")).toBeInTheDocument();
		expect(
			screen.queryByTestId("session-list-skeleton")
		).not.toBeInTheDocument();
	});

	it("invokes onCreate from the empty-state CTA", async () => {
		const onCreate = vi.fn();
		const user = userEvent.setup();
		renderList({ isLoading: false, onCreate, sessions: [] });
		await user.click(
			await screen.findByRole("button", { name: "New session" })
		);
		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it("renders one card per session when data is present", async () => {
		renderList({
			isLoading: false,
			onCreate: vi.fn(),
			sessions: [
				makeSession({ id: "s1", ringGameName: "1/2 NLH" }),
				makeSession({ id: "s2", ringGameName: "5/10 NLH" }),
			],
		});
		expect(await screen.findByText("1/2 NLH")).toBeInTheDocument();
		expect(screen.getByText("5/10 NLH")).toBeInTheDocument();
		expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
	});

	it("prefers the skeleton over the empty state while loading", async () => {
		renderList({ isLoading: true, onCreate: vi.fn(), sessions: [] });
		await screen.findByTestId("session-list-skeleton");
		expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
	});
});
