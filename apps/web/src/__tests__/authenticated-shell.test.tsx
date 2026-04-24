import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RootComponent } from "../routes/__root";
import { AuthenticatedShell } from "../shared/components/authenticated-shell";

const mocks = vi.hoisted(() => ({
	useLocation: vi.fn(() => ({ pathname: "/dashboard" })),
	getSession: vi.fn(),
	redirect: vi.fn((input: unknown) => {
		const err = new Error("redirect");
		(err as Error & { redirectTo?: unknown }).redirectTo = input;
		return err;
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	HeadContent: () => <div>Head Content</div>,
	Outlet: () => <div>Outlet Content</div>,
	createRootRouteWithContext: () => (options: unknown) => options,
	redirect: mocks.redirect,
	useLocation: mocks.useLocation,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: mocks.getSession,
	},
}));

vi.mock("@/shared/components/sidebar-nav", () => ({
	SidebarNav: () => <div>Sidebar Nav</div>,
}));

vi.mock("@/shared/components/mobile-nav", () => ({
	MobileNav: () => <div>Mobile Nav</div>,
}));

vi.mock("@/features/live-sessions/components/live-stack-form-sheet", () => ({
	LiveStackFormSheet: () => <div>Live Stack Sheet</div>,
}));

vi.mock("@/shared/components/online-status-bar", () => ({
	OnlineStatusBar: () => <div>Online Status</div>,
}));

vi.mock("@/shared/components/theme-provider", () => ({
	ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/components/ui/sonner", () => ({
	Toaster: () => <div>Toaster</div>,
}));

vi.mock("@/features/live-sessions/hooks/use-session-form", () => ({
	SessionFormProvider: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	StackSheetProvider: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("@/features/update-notes/components/update-notes-sheet", () => ({
	UpdateNotesProvider: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
	UpdateNotesSheet: () => <div>Update Notes Sheet</div>,
}));

describe("AuthenticatedShell", () => {
	it("renders the authenticated navigation shell", () => {
		render(
			<AuthenticatedShell>
				<div>Shell Body</div>
			</AuthenticatedShell>
		);

		expect(screen.getByText("Sidebar Nav")).toBeInTheDocument();
		expect(screen.getByText("Mobile Nav")).toBeInTheDocument();
		expect(screen.getByText("Live Stack Sheet")).toBeInTheDocument();
		expect(screen.getByText("Online Status")).toBeInTheDocument();
		expect(screen.getByText("Shell Body")).toBeInTheDocument();
	});
});

describe("RootComponent", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
		mocks.useLocation.mockReturnValue({ pathname: "/dashboard" });
	});

	it("renders the authenticated shell away from login", () => {
		render(<RootComponent />);

		expect(screen.getByText("Sidebar Nav")).toBeInTheDocument();
		expect(screen.getByText("Outlet Content")).toBeInTheDocument();
	});

	it("skips the authenticated shell on /login", () => {
		mocks.useLocation.mockReturnValue({ pathname: "/login" });

		render(<RootComponent />);

		expect(screen.queryByText("Sidebar Nav")).not.toBeInTheDocument();
		expect(screen.getByText("Outlet Content")).toBeInTheDocument();
	});

	it("renders the head content and toaster wrapper always", () => {
		mocks.useLocation.mockReturnValue({ pathname: "/dashboard" });

		render(<RootComponent />);

		expect(screen.getByText("Head Content")).toBeInTheDocument();
		expect(screen.getByText("Toaster")).toBeInTheDocument();
	});
});

describe("Root route beforeLoad guard", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
	});

	interface RouteWithBeforeLoad {
		beforeLoad: (ctx: { location: { pathname: string } }) => Promise<unknown>;
	}

	it("does not redirect when the user is visiting /login", async () => {
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;

		await expect(
			beforeLoad({ location: { pathname: "/login" } })
		).resolves.toBeUndefined();
		expect(mocks.getSession).not.toHaveBeenCalled();
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	it("redirects to /login when there is no authenticated session", async () => {
		mocks.getSession.mockResolvedValue({ data: null });
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;

		await expect(
			beforeLoad({ location: { pathname: "/dashboard" } })
		).rejects.toThrow("redirect");
		expect(mocks.redirect).toHaveBeenCalledWith({ to: "/login" });
	});

	it("allows the request to continue when a session exists", async () => {
		mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;

		await expect(
			beforeLoad({ location: { pathname: "/dashboard" } })
		).resolves.toBeUndefined();
		expect(mocks.redirect).not.toHaveBeenCalled();
	});
});
