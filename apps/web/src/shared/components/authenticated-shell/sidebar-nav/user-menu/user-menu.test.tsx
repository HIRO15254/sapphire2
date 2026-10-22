import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

const mocks = vi.hoisted(() => ({
	sessionState: {
		data: null as null | { user: { email: string; name: string } },
		isPending: false,
	},
	signOut: vi.fn(),
	navigate: vi.fn(),
	clearPersistedQueryCache: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => mocks.sessionState,
		signOut: mocks.signOut,
	},
}));

vi.mock("@/utils/trpc", () => ({
	clearPersistedQueryCache: mocks.clearPersistedQueryCache,
}));

describe("UserMenu", () => {
	beforeEach(() => {
		mocks.signOut.mockReset();
		mocks.navigate.mockReset();
		mocks.clearPersistedQueryCache.mockReset();
		mocks.clearPersistedQueryCache.mockResolvedValue(undefined);
		mocks.signOut.mockImplementation(
			(options: { fetchOptions: { onSuccess: () => Promise<void> } }) =>
				options.fetchOptions.onSuccess()
		);
	});

	it("shows the loading skeleton", () => {
		mocks.sessionState.isPending = true;
		mocks.sessionState.data = null;

		const { container } = render(<UserMenu />);

		expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
	});

	it("renders sign in when there is no session", () => {
		mocks.sessionState.isPending = false;
		mocks.sessionState.data = null;

		render(<UserMenu />);

		const signInLink = screen.getByRole("link", { name: "Sign In" });

		expect(signInLink).toHaveAttribute("href", "/login");
		expect(signInLink.querySelector("button")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Sign In" })
		).not.toBeInTheDocument();
	});

	it("keeps session identity wired to the menu and signs out once per click", async () => {
		const user = userEvent.setup();
		mocks.sessionState.isPending = false;
		mocks.sessionState.data = {
			user: { email: "hero@example.com", name: "Hero User" },
		};

		render(<UserMenu />);

		await user.click(screen.getByRole("button", { name: "Hero User" }));
		expect(screen.getByText("hero@example.com")).toBeInTheDocument();
		await user.click(screen.getByText("Sign Out"));

		expect(mocks.signOut).toHaveBeenCalledTimes(1);
	});
});
