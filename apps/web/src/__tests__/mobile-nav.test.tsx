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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ActiveSessionRoute } from "@/routes/active-session";
import { MobileNav } from "@/shared/components/authenticated-shell/mobile-nav";

vi.mock(
	"@/features/live-sessions/pages/live-session-page/cash-cockpit",
	() => ({
		CashCockpit: () => <div>Cash cockpit</div>,
	})
);

vi.mock(
	"@/features/live-sessions/pages/live-session-page/tournament-cockpit",
	() => ({
		TournamentCockpit: () => <div>Tournament cockpit</div>,
	})
);

const mockUseActiveSession = vi.fn();
vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => mockUseActiveSession(),
}));

vi.mock("@/features/live-sessions/components/create-session-dialog", () => ({
	CreateSessionDialog: () => null,
}));

vi.mock("@/utils/trpc", () => {
	const qo = () => ({ queryKey: [] });
	const proc = { queryOptions: qo };
	const makeRouter = (): Record<string, unknown> =>
		new Proxy({}, { get: () => proc });
	const trpc = new Proxy({}, { get: () => makeRouter() });
	return {
		trpcClient: {
			sessionEvent: {
				create: { mutate: () => undefined },
			},
		},
		trpc,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

function createTestRouter(initialPath: string) {
	const rootRoute = createRootRoute({
		component: () => (
			<>
				<Outlet />
				<MobileNav />
			</>
		),
	});

	const routes = [
		"/",
		"/statistics",
		"/resources",
		"/rooms",
		"/currencies",
		"/sessions",
		"/live-sessions",
		"/live-sessions/$sessionType/$sessionId/events",
		"/active-session",
		"/players",
		"/settings",
	].map((path) =>
		createRoute({
			getParentRoute: () => rootRoute,
			path,
			component:
				path === "/active-session"
					? ActiveSessionRoute.options.component
					: () => <div>{path}</div>,
		})
	);

	const routeTree = rootRoute.addChildren(routes);

	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [initialPath] }),
	});
}

describe("MobileNav - Normal Mode (no active session)", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});
	});

	it("renders 3 nav links, 1 resources popover button, and 1 center button", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(3);

		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(2);
	});

	it("displays normal mode labels", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Sessions");
		expect(screen.getByText("Statistics")).toBeInTheDocument();
		expect(screen.getByText("Resources")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("Start")).toBeInTheDocument();
	});

	it("highlights the active navigation item", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		const sessionsLink = await screen.findByText("Sessions");
		const anchor = sessionsLink.closest("a");
		expect(anchor?.className).toContain("text-sidebar-primary");
	});

	it("does not highlight inactive navigation items", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Sessions");
		const resourcesButton = screen.getByText("Resources");
		const button = resourcesButton.closest("button");
		expect(button?.className).toContain("text-sidebar-foreground");
	});
});

describe("MobileNav - Paused Session Mode", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: {
				id: "session-123",
				type: "cash_game",
				status: "paused",
			},
			hasActive: true,
			isLoading: false,
		});
	});

	it("renders 3 nav links, 1 resources popover button, and 1 center button (same as normal mode)", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(3);

		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(2);
	});

	it("displays normal mode nav items (Sessions, Statistics, Resources, Settings)", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Sessions");
		expect(screen.getByText("Statistics")).toBeInTheDocument();
		expect(screen.getByText("Resources")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("displays Resume as center button label", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Resume");
		expect(screen.getByText("Resume")).toBeInTheDocument();
	});
});

describe("MobileNav - Active Session Mode", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: {
				id: "session-123",
				type: "cash_game",
				status: "active",
			},
			hasActive: true,
			isLoading: false,
		});
	});

	it("keeps the normal nav items while a session is live", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Sessions");
		expect(screen.getByText("Statistics")).toBeInTheDocument();
		expect(screen.getByText("Resources")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("does not display the retired live session nav items (Timeline, Game, Overview)", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Statistics");
		expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
		expect(screen.queryByText("Game")).not.toBeInTheDocument();
		expect(screen.queryByText("Overview")).not.toBeInTheDocument();
	});

	it("shows 'Live' on the center button when off the active-session page", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Live");
		expect(screen.queryByText("Stack")).not.toBeInTheDocument();
	});

	it("keeps Live on the cockpit and leaves stack recording to the page", async () => {
		const router = createTestRouter("/active-session");
		render(<RouterProvider router={router} />);

		const user = userEvent.setup();
		await user.click(await screen.findByRole("button", { name: "Live" }));
		expect(await screen.findByText("Cash cockpit")).toBeInTheDocument();
		expect(screen.queryByText("Stack")).not.toBeInTheDocument();
	});

	it("opens the same production cockpit from Live and can leave via Sessions", async () => {
		const user = userEvent.setup();
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);
		await user.click(await screen.findByRole("button", { name: "Live" }));
		expect(await screen.findByText("Cash cockpit")).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/active-session");
		await user.click(screen.getByRole("link", { name: "Sessions" }));
		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/sessions");
		});
		expect(screen.queryByText("Cash cockpit")).not.toBeInTheDocument();
	});

	it("opens the tournament cockpit at the production URL", async () => {
		mockUseActiveSession.mockReturnValue({
			activeSession: {
				id: "tournament-1",
				type: "tournament",
				status: "active",
			},
			hasActive: true,
			isLoading: false,
		});
		render(<RouterProvider router={createTestRouter("/active-session")} />);
		expect(await screen.findByText("Tournament cockpit")).toBeInTheDocument();
	});

	it("center button has green styling in live mode", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Live");
		const centerButton = screen
			.getAllByRole("button")
			.find((b) => b.textContent?.includes("Live"));
		const greenDiv = centerButton?.querySelector("div");
		expect(greenDiv?.className).toContain("bg-green");
	});
});
