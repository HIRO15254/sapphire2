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

const mockUseActiveSession = vi.fn();
vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => mockUseActiveSession(),
}));

vi.mock("@/features/live-sessions/components/create-session-dialog", () => ({
	CreateSessionDialog: () => null,
}));

const { mockNavigate } = vi.hoisted(() => ({
	mockNavigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

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
		mockNavigate.mockReset();
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

const LIVE_CENTER_BUTTON_SCENARIOS = [
	{
		status: "active" as const,
		pathname: "/sessions",
		description: "an active session, off the active-session page",
	},
	{
		status: "active" as const,
		pathname: "/active-session",
		description: "an active session, already on the active-session page",
	},
	{
		status: "paused" as const,
		pathname: "/sessions",
		description: "a paused session, off the active-session page",
	},
	{
		status: "paused" as const,
		pathname: "/active-session",
		description: "a paused session, already on the active-session page",
	},
];

describe("MobileNav - center button always shows Live for any active session", () => {
	beforeEach(() => {
		mockNavigate.mockReset();
	});

	it.each(
		LIVE_CENTER_BUTTON_SCENARIOS
	)("shows only 'Live' for $description", async ({ status, pathname }) => {
		mockUseActiveSession.mockReturnValue({
			activeSession: {
				id: "session-123",
				type: "cash_game",
				status,
			},
			hasActive: true,
			isLoading: false,
		});
		const router = createTestRouter(pathname);
		render(<RouterProvider router={router} />);

		await screen.findByText("Live");
		expect(screen.queryByText("Stack")).not.toBeInTheDocument();
		expect(screen.queryByText("Resume")).not.toBeInTheDocument();
	});

	it.each(
		LIVE_CENTER_BUTTON_SCENARIOS
	)("clicking 'Live' navigates to /active-session exactly once for $description", async ({
		status,
		pathname,
	}) => {
		mockUseActiveSession.mockReturnValue({
			activeSession: {
				id: "session-123",
				type: "cash_game",
				status,
			},
			hasActive: true,
			isLoading: false,
		});
		const router = createTestRouter(pathname);
		render(<RouterProvider router={router} />);

		const button = await screen.findByRole("button", { name: "Live" });
		const user = userEvent.setup();
		await user.click(button);

		expect(mockNavigate).toHaveBeenCalledTimes(1);
		expect(mockNavigate).toHaveBeenCalledWith({ to: "/active-session" });
	});
});
