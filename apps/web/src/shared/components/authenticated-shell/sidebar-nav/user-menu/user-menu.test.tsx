import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

const mocks = vi.hoisted(() => ({
	menuState: {
		session: null as null | { user: { email: string; name: string } },
		isPending: false,
		updateNotesSheet: {
			isOpen: false,
			open: vi.fn(),
			close: vi.fn(),
			setIsOpen: vi.fn(),
		},
		onSignOut: vi.fn(),
	},
	useUserMenu: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("./use-user-menu", () => ({
	useUserMenu: mocks.useUserMenu,
}));

describe("UserMenu", () => {
	beforeEach(() => {
		mocks.menuState.updateNotesSheet.open.mockReset();
		mocks.menuState.onSignOut.mockReset();
		mocks.useUserMenu.mockReset();
		mocks.useUserMenu.mockImplementation(() => mocks.menuState);
	});

	it("shows the loading skeleton", () => {
		mocks.menuState.isPending = true;
		mocks.menuState.session = null;

		const { container } = render(<UserMenu />);

		expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
	});

	it("renders sign in when there is no session", () => {
		mocks.menuState.isPending = false;
		mocks.menuState.session = null;

		render(<UserMenu />);

		expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
			"href",
			"/login"
		);
	});

	it("renders the user trigger and calls onSignOut", async () => {
		const user = userEvent.setup();
		mocks.menuState.isPending = false;
		mocks.menuState.session = {
			user: { email: "hero@example.com", name: "Hero User" },
		};

		render(<UserMenu />);

		await user.click(screen.getByRole("button", { name: "Hero User" }));
		expect(screen.getByText("hero@example.com")).toBeInTheDocument();
		await user.click(screen.getByText("Sign Out"));

		expect(mocks.menuState.onSignOut).toHaveBeenCalledTimes(1);
	});
});
