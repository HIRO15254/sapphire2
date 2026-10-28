import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	locationAssignCalls,
	OAUTH_AUTHORIZE_SEARCH,
	stubLocation,
} from "@/__tests__/test-utils";
import { useSignUp } from "../use-sign-up";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	email: vi.fn(),
	social: vi.fn(),
	offer: vi.fn(),
}));
vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));
vi.mock("@/features/auth/utils/auto-register-passkey", () => ({
	offerAutomaticPasskey: mocks.offer,
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ isPending: false }),
		signUp: { email: mocks.email },
		signIn: { social: mocks.social },
	},
}));

describe("useSignUp", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	async function submit(form: ReturnType<typeof useSignUp>["form"]) {
		act(() => {
			form.setFieldValue("name", "Hero");
			form.setFieldValue("email", "user@example.com");
			form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await form.handleSubmit();
		});
	}
	it("enters the app and offers a passkey after sign-up", async () => {
		mocks.email.mockImplementation((_value, callbacks) => {
			callbacks.onSuccess();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		await submit(result.current.form);
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
		expect(mocks.offer).toHaveBeenCalledTimes(1);
	});
	it("resumes OAuth without offering a passkey", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.email.mockImplementation((_value, callbacks) => {
			callbacks.onSuccess();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		await submit(result.current.form);
		const url = new URL(locationAssignCalls()[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe(
			"http://localhost:8787/api/auth/mcp/authorize"
		);
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("state")).toBe("s1");
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.offer).not.toHaveBeenCalled();
	});
	it("reports a taken email only for the submitted address", async () => {
		mocks.email.mockImplementation((_value, callbacks) => {
			callbacks.onError({
				error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		await submit(result.current.form);
		expect(result.current.emailError("user@example.com")).toBe(
			"This email is already in use"
		);
		expect(result.current.emailError("other@example.com")).toBeUndefined();
		expect(mocks.offer).not.toHaveBeenCalled();
	});
	it("rejects a name shorter than two trimmed characters", async () => {
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", " A ");
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.email).not.toHaveBeenCalled();
	});
	it("preserves OAuth continuation for social sign-up", async () => {
		stubLocation({
			origin: "https://app.test",
			search: OAUTH_AUTHORIZE_SEARCH,
		});
		mocks.social.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useSignUp());
		await act(async () => {
			await result.current.onSignUpWithDiscord();
		});
		expect(mocks.social).toHaveBeenCalledWith({
			provider: "discord",
			callbackURL: `https://app.test/login${OAUTH_AUTHORIZE_SEARCH}`,
		});
	});
});
