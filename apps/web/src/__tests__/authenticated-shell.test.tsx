import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RootComponent } from "../routes/__root";

const mocks = vi.hoisted(() => ({
	useLocation: vi.fn(() => ({ pathname: "/settings" })),
	getSession: vi.fn(),
	useSession: { get: vi.fn() },
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
		useSession: mocks.useSession,
	},
}));

vi.mock("@/shared/hooks/use-pwa-update", () => ({
	usePwaUpdate: vi.fn(),
}));

vi.mock(
	"@/shared/components/authenticated-shell/use-authenticated-shell",
	() => ({
		useAuthenticatedShell: () => ({ isDesktop: false }),
	})
);

vi.mock("@/shared/components/authenticated-shell/mobile-nav", () => ({
	MobileNav: () => <div>Mobile Nav</div>,
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

vi.mock("@/features/update-notes/components/update-notes-sheet", () => ({
	UpdateNotesProvider: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
	UpdateNotesSheet: () => <div>Update Notes Sheet</div>,
}));

describe("RootComponent", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
		mocks.useLocation.mockReturnValue({ pathname: "/settings" });
	});

	it("renders the authenticated shell away from login", () => {
		render(<RootComponent />);

		expect(screen.getByText("Mobile Nav")).toBeInTheDocument();
		expect(screen.getByText("Outlet Content")).toBeInTheDocument();
	});

	it("skips the authenticated shell on /login", () => {
		mocks.useLocation.mockReturnValue({ pathname: "/login" });

		render(<RootComponent />);

		expect(screen.queryByText("Mobile Nav")).not.toBeInTheDocument();
		expect(screen.getByText("Outlet Content")).toBeInTheDocument();
	});

	it("renders the head content and toaster wrapper always", () => {
		mocks.useLocation.mockReturnValue({ pathname: "/settings" });

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
			beforeLoad({ location: { pathname: "/settings" } })
		).rejects.toThrow("redirect");
		expect(mocks.redirect).toHaveBeenCalledWith({ to: "/login" });
	});

	it("allows the request to continue and exposes the session in context", async () => {
		const session = { data: { user: { id: "u1" } } };
		mocks.getSession.mockResolvedValue(session);
		const { Route } = await import("../routes/__root");
		const beforeLoad = (Route as unknown as RouteWithBeforeLoad).beforeLoad;

		await expect(
			beforeLoad({ location: { pathname: "/settings" } })
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
			beforeLoad({ location: { pathname: "/settings" } })
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
			beforeLoad({ location: { pathname: "/settings" } })
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
