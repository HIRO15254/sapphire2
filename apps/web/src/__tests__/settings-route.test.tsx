import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	signOut: vi.fn(),
	clearPersistedQueryCache: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/features/settings/pages/settings-page/linked-accounts", () => ({
	LinkedAccounts: () => <div>Linked Accounts Content</div>,
}));

vi.mock("@/features/settings/pages/settings-page/about-section", () => ({
	AboutSection: () => <div>About Content</div>,
}));

vi.mock("@/features/settings/pages/settings-page/game-groups-section", () => ({
	GameGroupsSection: () => <div>Game Groups Content</div>,
}));

vi.mock(
	"@/features/settings/pages/settings-page/game-variants-section",
	() => ({
		GameVariantsSection: () => <div>Game Variants Content</div>,
	})
);

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: mocks.signOut,
	},
}));

vi.mock("@/utils/trpc", () => ({
	clearPersistedQueryCache: mocks.clearPersistedQueryCache,
}));

let routeModule: typeof import("@/routes/settings");

describe("SettingsComponent", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/settings");
	});

	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.signOut.mockReset();
		mocks.clearPersistedQueryCache.mockReset();
		mocks.clearPersistedQueryCache.mockResolvedValue(undefined);
		mocks.signOut.mockImplementation(
			(options?: { fetchOptions?: { onSuccess?: () => void } }) => {
				options?.fetchOptions?.onSuccess?.();
			}
		);
	});

	it("renders the page header and section helper text", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "Settings" })
		).toBeInTheDocument();
		expect(screen.getByText("Linked accounts")).toBeInTheDocument();
		expect(screen.getByText("About")).toBeInTheDocument();
		expect(screen.getByText("Game groups")).toBeInTheDocument();
		expect(screen.getByText("Game variants")).toBeInTheDocument();
	});

	it("renders the Game groups section body", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Game Groups Content")).toBeInTheDocument();
	});

	it("renders the Game variants section body", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Game Variants Content")).toBeInTheDocument();
	});

	it("renders the About section body", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("About Content")).toBeInTheDocument();
	});

	it("signs out from the page header action", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		await user.click(screen.getByRole("button", { name: "Sign out" }));

		expect(mocks.signOut).toHaveBeenCalledOnce();
		expect(mocks.clearPersistedQueryCache).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
		expect(
			mocks.clearPersistedQueryCache.mock.invocationCallOrder[0]
		).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
	});

	it("does not navigate when signOut does not call onSuccess", async () => {
		const user = userEvent.setup();
		// Override: signOut is called but the onSuccess callback is never invoked
		mocks.signOut.mockImplementation(() => undefined);
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		await user.click(screen.getByRole("button", { name: "Sign out" }));

		expect(mocks.signOut).toHaveBeenCalledOnce();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("renders the Linked Accounts section body", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Linked Accounts Content")).toBeInTheDocument();
	});

	it("forwards the fetchOptions.onSuccess wiring so navigate fires exactly once per success", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		await user.click(screen.getByRole("button", { name: "Sign out" }));
		await user.click(screen.getByRole("button", { name: "Sign out" }));

		expect(mocks.signOut).toHaveBeenCalledTimes(2);
		expect(mocks.navigate).toHaveBeenCalledTimes(2);
	});
});
