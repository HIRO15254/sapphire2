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
		breakMinutes: null,
		chipPurchaseCost: 0,
		currencyUnit: null,
		endedAt: null,
		entryFee: null,
		evProfitLoss: null,
		placement: null,
		profitLoss: 0,
		ringGameBlind2: null,
		ringGameName: "1/2 NLH",
		roomName: null,
		sessionDate: "2026-01-15",
		source: "manual",
		startedAt: null,
		tags: [],
		totalEntries: null,
		tournamentBuyIn: null,
		tournamentName: null,
		type: "cash_game",
		...overrides,
	};
}

function renderList(
	props: Partial<React.ComponentProps<typeof SessionList>> & {
		isLoading: boolean;
		onCreate: () => void;
		sessions: SessionListCardItem[];
	}
) {
	const rootRoute = createRootRoute({
		component: () => (
			<SessionList
				bbBiMode={false}
				hasNextPage={false}
				isFetchingNextPage={false}
				onLoadMore={() => undefined}
				{...props}
			/>
		),
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

	it("renders a Load more button when another page is available", async () => {
		renderList({
			hasNextPage: true,
			isLoading: false,
			onCreate: vi.fn(),
			sessions: [makeSession({ id: "s1" })],
		});
		expect(
			await screen.findByRole("button", { name: "Load more" })
		).toBeInTheDocument();
	});

	it("omits the Load more button when there is no next page", async () => {
		renderList({
			hasNextPage: false,
			isLoading: false,
			onCreate: vi.fn(),
			sessions: [makeSession({ id: "s1" })],
		});
		await screen.findByText("1/2 NLH");
		expect(
			screen.queryByRole("button", { name: "Load more" })
		).not.toBeInTheDocument();
	});

	it("invokes onLoadMore when the Load more button is clicked", async () => {
		const onLoadMore = vi.fn();
		const user = userEvent.setup();
		renderList({
			hasNextPage: true,
			isLoading: false,
			onCreate: vi.fn(),
			onLoadMore,
			sessions: [makeSession({ id: "s1" })],
		});
		await user.click(await screen.findByRole("button", { name: "Load more" }));
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});

	it("disables the button and shows Loading while fetching the next page", async () => {
		renderList({
			hasNextPage: true,
			isFetchingNextPage: true,
			isLoading: false,
			onCreate: vi.fn(),
			sessions: [makeSession({ id: "s1" })],
		});
		expect(
			await screen.findByRole("button", { name: "Loading..." })
		).toBeDisabled();
	});
});
