import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RootComponent } from "../routes/__root";
import { AuthenticatedShell } from "../shared/components/authenticated-shell";

const mocks = vi.hoisted(() => ({
	useLocation: vi.fn(() => ({ pathname: "/statistics" })),
	getSession: vi.fn(),
	useSession: { get: vi.fn() },
	redirect: vi.fn((input: unknown) => {
		const err = new Error("redirect");
		(err as Error & { redirectTo?: unknown }).redirectTo = input;
		return err;
	}),
	isDesktop: false,
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
		useSession: mocks.useSession,
	},
}));

vi.mock("@/shared/hooks/use-pwa-update", () => ({
	usePwaUpdate: vi.fn(),
}));

vi.mock(
	"@/shared/components/authenticated-shell/use-authenticated-shell",
	() => ({
		useAuthenticatedShell: () => ({ isDesktop: mocks.isDesktop }),
	})
);

vi.mock("@/shared/components/authenticated-shell/sidebar-nav", () => ({
	SidebarNav: () => <div>Sidebar Nav</div>,
}));

vi.mock("@/shared/components/authenticated-shell/mobile-nav", () => ({
	MobileNav: () => <div>Mobile Nav</div>,
}));

vi.mock("@/features/live-sessions/components/live-stack-form-sheet", () => ({
	LiveStackFormSheet: () => <div>Live Stack Sheet</div>,
}));

vi.mock("@/shared/components/authenticated-shell/online-status-bar", () => ({
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
	beforeEach(() => {
		mocks.isDesktop = false;
	});

	it("renders the authenticated navigation shell on mobile viewports", () => {
		mocks.isDesktop = false;
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
		expect(screen.queryByText("Use on your phone")).not.toBeInTheDocument();
	});

	it("blocks desktop viewports with the mobile-only empty state", () => {
		mocks.isDesktop = true;
		render(
			<AuthenticatedShell>
				<div>Shell Body</div>
			</AuthenticatedShell>
		);

		expect(screen.getByText("Use on your phone")).toBeInTheDocument();
		expect(
			screen.getByText(
				"This app is optimized for mobile. Open it on a smartphone to continue."
			)
		).toBeInTheDocument();
		expect(screen.queryByText("Sidebar Nav")).not.toBeInTheDocument();
		expect(screen.queryByText("Mobile Nav")).not.toBeInTheDocument();
		expect(screen.queryByText("Shell Body")).not.toBeInTheDocument();
		expect(screen.queryByText("Live Stack Sheet")).not.toBeInTheDocument();
	});
});

describe("RootComponent", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
		mocks.useLocation.mockReturnValue({ pathname: "/statistics" });
		mocks.isDesktop = false;
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
		mocks.useLocation.mockReturnValue({ pathname: "/statistics" });

		render(<RootComponent />);

		expect(screen.getByText("Head Content")).toBeInTheDocument();
		expect(screen.getByText("Toaster")).toBeInTheDocument();
	});
});

describe("Root route beforeLoad guard", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.useSession.get.mockReset();
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
		).resolves.toEqual({ session: null, sessionUnavailable: false });
		expect(mocks.getSession).not.toHaveBeenCalled();
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	it("redirects to /login when there is no authenticated session", async () => {
		mocks.getSession.mockResolvedValue({ data: null });
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;

		await expect(
			beforeLoad({ location: { pathname: "/statistics" } })
		).rejects.toThrow("redirect");
		expect(mocks.redirect).toHaveBeenCalledWith({ to: "/login" });
	});

	it("allows the request to continue and exposes the session in context", async () => {
		const session = { data: { user: { id: "u1" } } };
		mocks.getSession.mockResolvedValue(session);
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;

		await expect(
			beforeLoad({ location: { pathname: "/statistics" } })
		).resolves.toEqual({ session, sessionUnavailable: false });
		expect(mocks.getSession).toHaveBeenCalledTimes(1);
		expect(mocks.redirect).not.toHaveBeenCalled();
	});
	it("continues with an unavailable session when offline verification fails", async () => {
		mocks.getSession.mockRejectedValue(new Error("network unavailable"));
		Object.defineProperty(window.navigator, "onLine", {
			configurable: true,
			value: false,
		});
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;
		await expect(
			beforeLoad({ location: { pathname: "/statistics" } })
		).resolves.toEqual({ session: null, sessionUnavailable: true });
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	it("rethrows session errors while online", async () => {
		mocks.getSession.mockRejectedValue(new Error("network unavailable"));
		Object.defineProperty(window.navigator, "onLine", {
			configurable: true,
			value: true,
		});
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;
		await expect(
			beforeLoad({ location: { pathname: "/statistics" } })
		).rejects.toThrow("network unavailable");
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	it("provides an explicit route error component for transient auth failures", async () => {
		const { Route } = await import("../routes/__root");
		expect(
			(Route as unknown as { errorComponent?: unknown }).errorComponent
		).toBeDefined();
	});
});
