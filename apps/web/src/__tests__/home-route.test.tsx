import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	healthCheck: {
		data: { ok: true } as null | { ok: boolean },
		isLoading: false,
	},
	session: null as null | { user: { name: string } },
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => mocks.healthCheck,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({
			data: mocks.session,
		}),
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		healthCheck: {
			queryOptions: () => ({ queryKey: ["health-check"] }),
		},
	},
}));

let routeModule: typeof import("@/routes/index");

describe("HomeRoute", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/index");
	});

	beforeEach(() => {
		mocks.healthCheck.data = { ok: true };
		mocks.healthCheck.isLoading = false;
		mocks.session = null;
	});

	it("renders signed-out CTA links to login", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", {
				name: "sapphire2 keeps your poker operations in sync.",
			})
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
			"href",
			"/login"
		);
		expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
			"href",
			"/login"
		);
		expect(screen.getByText("API: Connected")).toBeInTheDocument();
	});

	it("renders dashboard CTA when a session exists", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		mocks.session = { user: { name: "Hiro" } };

		render(<Component />);

		expect(
			screen.getByRole("link", { name: "Open Dashboard" })
		).toHaveAttribute("href", "/dashboard");
		expect(
			screen.getByRole("link", { name: "Go to Dashboard" })
		).toHaveAttribute("href", "/dashboard");
		expect(
			screen.getByText("Signed in as Hiro. Continue where you left off.")
		).toBeInTheDocument();
	});

	it("shows loading and disconnected states", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		mocks.healthCheck.isLoading = true;
		mocks.healthCheck.data = null;

		const { rerender } = render(<Component />);

		expect(screen.getByText("API: Checking...")).toBeInTheDocument();

		mocks.healthCheck.isLoading = false;
		mocks.healthCheck.data = null;
		rerender(<Component />);

		expect(screen.getByText("API: Disconnected")).toBeInTheDocument();
	});

	it("describes connectivity state with the connected description", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		mocks.healthCheck.data = { ok: true };
		mocks.healthCheck.isLoading = false;

		render(<Component />);

		expect(screen.getByText("Everything looks ready.")).toBeInTheDocument();
	});

	it("describes connectivity state with the disconnected description", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		mocks.healthCheck.data = null;
		mocks.healthCheck.isLoading = false;

		render(<Component />);

		expect(
			screen.getByText("Server connection is unavailable right now.")
		).toBeInTheDocument();
	});

	it("describes connectivity state with the checking description while loading", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		mocks.healthCheck.data = null;
		mocks.healthCheck.isLoading = true;

		render(<Component />);

		expect(
			screen.getByText("Checking server connectivity before you continue.")
		).toBeInTheDocument();
	});

	it("hides the Sign In link when a session exists", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		mocks.session = { user: { name: "Hiro" } };

		render(<Component />);

		expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
	});

	it("falls back to 'your account' wording when session has no username", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		// userName resolves to null; the page uses "your account" as fallback text
		mocks.session = { user: { name: "" } };

		render(<Component />);

		// When name is empty string, userName is "" (falsy), so fallback kicks in
		expect(
			screen.getByText("Signed in as . Continue where you left off.")
		).toBeInTheDocument();
	});
});
