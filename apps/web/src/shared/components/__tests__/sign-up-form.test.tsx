import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SignUpForm from "../sign-up-form";

const SIGN_UP_BUTTON_NAME = "Sign Up";

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
	it("renders auth fields and provider buttons", () => {
		render(<SignUpForm onSwitchToSignIn={mocks.onSwitchToSignIn} />);

		expect(screen.getByLabelText("Name")).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Sign up with Google" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Sign up with Discord" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Already have an account? Sign In" })
		).toBeInTheDocument();
	});

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

		await user.click(
			screen.getByRole("button", { name: "Already have an account? Sign In" })
		);
		expect(mocks.onSwitchToSignIn).toHaveBeenCalledTimes(1);
	});
});
