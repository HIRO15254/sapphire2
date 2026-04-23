import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const BACK_PATTERN = /back/i;

const storeQueryState = vi.hoisted(() => ({
	data: null as { id: string; memo?: string | null; name: string } | null,
	isLoading: false,
}));
const routeParamsMock = vi.hoisted(() => vi.fn(() => ({ storeId: "store-1" })));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => storeQueryState,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
		useParams: () => routeParamsMock(),
	}),
}));

vi.mock("@/features/stores/components/ring-game-tab", () => ({
	RingGameTab: () => <div>Cash Games Content</div>,
}));

vi.mock("@/features/stores/components/tournament-tab", () => ({
	TournamentTab: () => <div>Tournaments Content</div>,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		store: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["store", id],
				}),
			},
		},
	},
}));

let routeModule: typeof import("@/routes/stores/$storeId");

describe("StoreDetailPage", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/stores/$storeId");
	});

	beforeEach(() => {
		storeQueryState.data = null;
		storeQueryState.isLoading = false;
	});

	it("renders the loading state", () => {
		storeQueryState.isLoading = true;
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Loading store...")).toBeInTheDocument();
	});

	it("renders the not found state", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Store not found.")).toBeInTheDocument();
	});

	it("renders the store memo in the header and switches tabs", async () => {
		const user = userEvent.setup();
		storeQueryState.data = {
			id: "store-1",
			memo: "Late-night sessions",
			name: "Akiba Poker Room",
		};

		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "Akiba Poker Room" })
		).toBeInTheDocument();
		expect(screen.getByText("Late-night sessions")).toBeInTheDocument();
		expect(screen.getByText("Cash Games Content")).toBeInTheDocument();

		await user.click(screen.getByRole("tab", { name: "Tournaments" }));

		expect(screen.getByText("Tournaments Content")).toBeInTheDocument();
	});

	it("renders without a memo description when memo is null", () => {
		storeQueryState.data = {
			id: "store-1",
			memo: null,
			name: "No Memo Store",
		};

		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "No Memo Store" })
		).toBeInTheDocument();
	});

	it("renders a Back link pointing to /stores", () => {
		storeQueryState.data = {
			id: "store-1",
			memo: null,
			name: "Akiba",
		};

		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		const backLink = screen.getByRole("link", { name: BACK_PATTERN });
		expect(backLink).toHaveAttribute("href", "/stores");
	});

	it("passes the storeId from route params into the tab components", () => {
		routeParamsMock.mockReturnValue({ storeId: "custom-store-id" });
		storeQueryState.data = {
			id: "custom-store-id",
			memo: null,
			name: "Custom",
		};

		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Cash Games Content")).toBeInTheDocument();
		// Restore for subsequent tests
		routeParamsMock.mockReturnValue({ storeId: "store-1" });
	});

	it("defaults to the Cash Games tab being active", () => {
		storeQueryState.data = {
			id: "store-1",
			memo: null,
			name: "Akiba",
		};

		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		const cashGamesTab = screen.getByRole("tab", { name: "Cash Games" });
		expect(cashGamesTab).toHaveAttribute("aria-selected", "true");
	});
});
