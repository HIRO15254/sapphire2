import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "../components/mobile-nav";

// Mock useActiveSession to control nav mode
const mockUseActiveSession = vi.fn();
vi.mock("@/hooks/use-active-session", () => ({
	useActiveSession: () => mockUseActiveSession(),
}));

// Mock CreateSessionDialog to avoid trpc/env imports
vi.mock("@/components/live-sessions/create-session-dialog", () => ({
	CreateSessionDialog: () => null,
}));

// Mock useStackSheet to avoid provider requirement
vi.mock("@/hooks/use-stack-sheet", () => ({
	useStackSheet: () => ({
		isOpen: false,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
	}),
}));

function createTestRouter(initialPath: string) {
	const rootRoute = createRootRoute({
		component: () => <MobileNav />,
	});

	const routes = [
		"/",
		"/dashboard",
		"/stores",
		"/currencies",
		"/sessions",
		"/live-sessions",
		"/live-sessions/cash-game/$sessionId",
		"/live-sessions/cash-game/$sessionId/events",
		"/live-sessions/$sessionType/$sessionId/events",
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

	it("renders 4 nav links and 1 center button", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(4);

		const centerButton = screen.getByRole("button");
		expect(centerButton).toBeInTheDocument();
	});

	it("displays normal mode labels", async () => {
		const router = createTestRouter("/sessions");
		render(<RouterProvider router={router} />);

		await screen.findByText("Sessions");
		expect(screen.getByText("Stores")).toBeInTheDocument();
		expect(screen.getByText("Players")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("New")).toBeInTheDocument();
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
		const storesLink = screen.getByText("Stores");
		const anchor = storesLink.closest("a");
		expect(anchor?.className).toContain("text-sidebar-foreground");
	});
});

describe("MobileNav - Live Session Mode (active session)", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "session-123", type: "cash_game" },
			hasActive: true,
			isLoading: false,
		});
	});

	it("renders 4 nav links and 1 center button", async () => {
		const router = createTestRouter("/live-sessions/cash-game/session-123");
		render(<RouterProvider router={router} />);

		const links = await screen.findAllByRole("link");
		expect(links).toHaveLength(4);

		const centerButton = screen.getByRole("button");
		expect(centerButton).toBeInTheDocument();
	});

	it("displays live mode labels with dynamic events link", async () => {
		const router = createTestRouter("/live-sessions/cash-game/session-123");
		render(<RouterProvider router={router} />);

		await screen.findByText("Events");
		expect(screen.getByText("Players")).toBeInTheDocument();
		expect(screen.getByText("Overview")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("Stack")).toBeInTheDocument();
	});

	it("center button has green styling in live mode", async () => {
		const router = createTestRouter("/live-sessions/cash-game/session-123");
		render(<RouterProvider router={router} />);

		await screen.findByText("Stack");
		const centerButton = screen.getByRole("button");
		const greenDiv = centerButton.querySelector("div");
		expect(greenDiv?.className).toContain("bg-green");
	});
});
