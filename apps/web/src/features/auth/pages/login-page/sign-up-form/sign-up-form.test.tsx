import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SignUpForm from "./sign-up-form";

const SIGN_UP_BUTTON_NAME = "Create account";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	onSwitchToSignIn: vi.fn(),
	signInSocial: vi.fn(),
	signUpEmail: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: {
			social: mocks.signInSocial,
		},
		signUp: {
			email: mocks.signUpEmail,
		},
		useSession: () => ({
			isPending: false,
		}),
	},
}));

describe("SignUpForm", () => {
	it("submits valid credentials and calls the switch callback", async () => {
		const user = userEvent.setup();
		mocks.signUpEmail.mockResolvedValue(undefined);

		render(<SignUpForm onSwitchToSignIn={mocks.onSwitchToSignIn} />);

		const submitButton = screen.getByRole("button", {
			name: SIGN_UP_BUTTON_NAME,
		});

		await user.type(screen.getByLabelText("Name"), "Hero");
		await user.type(screen.getByLabelText("Email"), "hero@example.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(submitButton);

		await waitFor(() => {
			expect(mocks.signUpEmail).toHaveBeenCalled();
		});

		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(mocks.onSwitchToSignIn).toHaveBeenCalledTimes(1);
	});

	it("marks the taken email invalid until the email changes", async () => {
		const user = userEvent.setup();
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks.onError({ error: { code: "USER_ALREADY_EXISTS" } });
			return Promise.resolve();
		});
		render(<SignUpForm onSwitchToSignIn={mocks.onSwitchToSignIn} />);
		await user.type(screen.getByLabelText("Name"), "Hero");
		await user.type(screen.getByLabelText("Email"), "hero@example.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(screen.getByRole("button", { name: SIGN_UP_BUTTON_NAME }));
		expect(
			await screen.findByText("This email is already in use")
		).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
		await user.type(screen.getByLabelText("Email"), "x");
		expect(
			screen.queryByText("This email is already in use")
		).not.toBeInTheDocument();
	});
});
