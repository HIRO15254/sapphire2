import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "../user-menu";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	sessionState: {
		data: null as null | {
			user: {
				email: string;
				name: string;
			};
		},
		isPending: false,
	},
	signOut: vi.fn(),
	updateNotesSheet: {
		isOpen: false,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
	},
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: mocks.signOut,
		useSession: () => mocks.sessionState,
	},
}));

vi.mock("@/update-notes/components/update-notes-sheet", () => ({
	useUpdateNotesSheet: () => mocks.updateNotesSheet,
}));

describe("UserMenu", () => {
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

		expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
			"href",
			"/login"
		);
	});

	it("renders the user trigger and signs out to home", async () => {
		const user = userEvent.setup();
		mocks.sessionState.isPending = false;
		mocks.sessionState.data = {
			user: {
				email: "hero@example.com",
				name: "Hero User",
			},
		};
		mocks.signOut.mockImplementation(
			({ fetchOptions }: { fetchOptions: { onSuccess: () => void } }) => {
				fetchOptions.onSuccess();
			}
		);

		render(<UserMenu />);

		await user.click(screen.getByRole("button", { name: "Hero User" }));
		expect(screen.getByText("hero@example.com")).toBeInTheDocument();
		await user.click(screen.getByText("Sign Out"));

		expect(mocks.signOut).toHaveBeenCalled();
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
	});
});
