import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RootComponent } from "../routes/__root";
import { AuthenticatedShell } from "../shared/components/authenticated-shell";

const mocks = vi.hoisted(() => ({
	useLocation: vi.fn(() => ({ pathname: "/dashboard" })),
}));

vi.mock("@tanstack/react-router", () => ({
	HeadContent: () => <div>Head Content</div>,
	Outlet: () => <div>Outlet Content</div>,
	createRootRouteWithContext: () => () => ({}),
	redirect: vi.fn(),
	useLocation: mocks.useLocation,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: vi.fn(),
	},
}));

vi.mock("@/shared/components/sidebar-nav", () => ({
	SidebarNav: () => <div>Sidebar Nav</div>,
}));

vi.mock("@/shared/components/mobile-nav", () => ({
	MobileNav: () => <div>Mobile Nav</div>,
}));

vi.mock("@/live-sessions/components/live-stack-form-sheet", () => ({
	LiveStackFormSheet: () => <div>Live Stack Sheet</div>,
}));

vi.mock("@/shared/components/online-status-bar", () => ({
	OnlineStatusBar: () => <div>Online Status</div>,
}));

vi.mock("@/shared/components/devtools-toggle", () => ({
	DevtoolsToggle: () => <div>Devtools Toggle</div>,
}));

vi.mock("@/shared/components/theme-provider", () => ({
	ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/components/ui/sonner", () => ({
	Toaster: () => <div>Toaster</div>,
}));

vi.mock("@/live-sessions/hooks/use-session-form", () => ({
	SessionFormProvider: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("@/live-sessions/hooks/use-stack-sheet", () => ({
	StackSheetProvider: ({ children }: { children: ReactNode }) => (
		<>{children}</>
	),
}));

function renderWithQueryClient(children: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

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
		expect(screen.getByText("Devtools Toggle")).toBeInTheDocument();
		expect(screen.getByText("Shell Body")).toBeInTheDocument();
	});
});

describe("RootComponent", () => {
	it("renders the authenticated shell away from login", () => {
		renderWithQueryClient(<RootComponent />);

		expect(screen.getByText("Sidebar Nav")).toBeInTheDocument();
		expect(screen.getByText("Outlet Content")).toBeInTheDocument();
	});

	it("skips the authenticated shell on /login", () => {
		mocks.useLocation.mockReturnValue({ pathname: "/login" });

		renderWithQueryClient(<RootComponent />);

		expect(screen.queryByText("Sidebar Nav")).not.toBeInTheDocument();
		expect(screen.getByText("Outlet Content")).toBeInTheDocument();
	});
});
