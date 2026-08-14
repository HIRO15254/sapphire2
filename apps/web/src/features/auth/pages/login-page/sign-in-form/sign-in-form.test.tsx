import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { stubWebAuthnSupport } from "@/__tests__/test-utils";
import SignInForm from "./sign-in-form";

const SIGN_IN_BUTTON_NAME = "Sign In";

const PASSKEY_BUTTON_NAME = "Sign in with a passkey";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	onSwitchToSignUp: vi.fn(),
	signInEmail: vi.fn(),
	signInSocial: vi.fn(),
	signInPasskey: vi.fn(),
}));

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
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
			email: mocks.signInEmail,
			social: mocks.signInSocial,
			passkey: mocks.signInPasskey,
		},
		useSession: () => ({
			isPending: false,
		}),
	},
}));

describe("SignInForm", () => {
	it("renders auth fields and provider buttons", () => {
		render(<SignInForm onSwitchToSignUp={mocks.onSwitchToSignUp} />);

		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Sign in with Google" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Sign in with Discord" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Need an account? Sign Up" })
		).toBeInTheDocument();
	});

	it("submits valid credentials and calls the switch callback", async () => {
		const user = userEvent.setup();
		mocks.signInEmail.mockResolvedValue(undefined);

		render(<SignInForm onSwitchToSignUp={mocks.onSwitchToSignUp} />);

		const submitButton = screen.getByRole("button", {
			name: SIGN_IN_BUTTON_NAME,
		});

		await user.type(screen.getByLabelText("Email"), "hero@example.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(submitButton);

		await waitFor(() => {
			expect(mocks.signInEmail).toHaveBeenCalled();
		});

		await user.click(
			screen.getByRole("button", { name: "Need an account? Sign Up" })
		);
		expect(mocks.onSwitchToSignUp).toHaveBeenCalledTimes(1);
	});

	it("hides the passkey button where the browser has no WebAuthn", () => {
		const restore = stubWebAuthnSupport(false);
		render(<SignInForm onSwitchToSignUp={mocks.onSwitchToSignUp} />);
		expect(
			screen.queryByRole("button", { name: PASSKEY_BUTTON_NAME })
		).not.toBeInTheDocument();
		restore();
	});

	it("starts the passkey ceremony when the button is clicked", async () => {
		const restore = stubWebAuthnSupport(true);
		const user = userEvent.setup();
		mocks.signInPasskey.mockResolvedValue({ data: { session: {} } });

		render(<SignInForm onSwitchToSignUp={mocks.onSwitchToSignUp} />);
		await user.click(screen.getByRole("button", { name: PASSKEY_BUTTON_NAME }));

		await waitFor(() => {
			expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);
		});
		restore();
	});
});
