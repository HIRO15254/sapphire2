import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "@/shared/components/authenticated-shell/mobile-nav";

// Mock useActiveSession to control nav mode
const mockUseActiveSession = vi.fn();
vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => mockUseActiveSession(),
}));

// Mock CreateSessionDialog to avoid trpc/env imports
vi.mock("@/features/live-sessions/components/create-session-dialog", () => ({
	CreateSessionDialog: () => null,
}));

// Mock useStackSheet to avoid provider requirement
const mockStackOpen = vi.fn();
vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	useStackSheet: () => ({
		isOpen: false,
		open: mockStackOpen,
		close: vi.fn(),
		setIsOpen: vi.fn(),
	}),
}));

// Mock trpc to avoid env validation
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

// Mock react-query hooks used directly in MobileNav
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
		component: () => <MobileNav />,
	});

	const routes = [
		"/",
		"/statistics",
		"/resources",
		"/rooms",
		"/currencies",
		"/game-variants",
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
			component: () => <div>{path}</div>,
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

	it("lists Game variants alongside the other resource links when the Resources popover opens", async () => {
		const user = userEvent.setup();
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Sessions");
		await user.click(screen.getByRole("button", { name: "Resources" }));

		expect(
			await screen.findByRole("link", { name: "Game variants" })
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Rooms" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Players" })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Currencies" })
		).toBeInTheDocument();
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
		mockStackOpen.mockReset();
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

	it("shows 'Stack' on the center button on the active-session page", async () => {
		const router = createTestRouter("/active-session");
		render(<RouterProvider router={router} />);

		await screen.findByText("Stack");
		expect(screen.queryByText("Live")).not.toBeInTheDocument();
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
