import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	locationAssignCalls,
	OAUTH_AUTHORIZE_SEARCH,
	stubLocation,
} from "@/__tests__/test-utils";
import { useSignIn } from "../use-sign-in";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	email: vi.fn(),
	social: vi.fn(),
	passkey: vi.fn(),
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
		signIn: {
			email: mocks.email,
			social: mocks.social,
			passkey: mocks.passkey,
		},
	},
}));

describe("useSignIn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	async function submit(result: { current: ReturnType<typeof useSignIn> }) {
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
	}
	it("enters the app and offers a passkey after password sign-in", async () => {
		mocks.email.mockImplementation((_value, callbacks) => {
			callbacks.onSuccess();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		await submit(result);
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
		expect(mocks.offer).toHaveBeenCalledTimes(1);
	});
	it("resumes OAuth without offering a passkey", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.email.mockImplementation((_value, callbacks) => {
			callbacks.onSuccess();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		await submit(result);
		const url = new URL(locationAssignCalls()[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe(
			"http://localhost:8787/api/auth/mcp/authorize"
		);
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("state")).toBe("s1");
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.offer).not.toHaveBeenCalled();
	});
	it("surfaces failures without offering a passkey", async () => {
		mocks.email.mockImplementation((_value, callbacks) => {
			callbacks.onError({ error: { message: "Unavailable" } });
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		await submit(result);
		expect(result.current.errorMessage).toBe("Unavailable");
		expect(mocks.offer).not.toHaveBeenCalled();
	});
	it("keeps a cancelled passkey ceremony silent", async () => {
		mocks.passkey.mockResolvedValue({
			data: null,
			error: { code: "AUTH_CANCELLED", message: "Auth cancelled" },
		});
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(result.current.errorMessage).toBeNull();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});
	it("guards an in-flight passkey ceremony and does not offer an upgrade", async () => {
		const { promise, resolve } = Promise.withResolvers<unknown>();
		mocks.passkey.mockReturnValue(promise);
		const { result } = renderHook(() => useSignIn());
		let first: Promise<void> | undefined;
		act(() => {
			first = result.current.onSignInWithPasskey();
		});
		await waitFor(() => expect(result.current.isPasskeyPending).toBe(true));
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(mocks.passkey).toHaveBeenCalledTimes(1);
		await act(async () => {
			resolve({ data: { session: {} } });
			await first;
		});
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
		expect(mocks.offer).not.toHaveBeenCalled();
	});
	it("reports passkey failures", async () => {
		mocks.passkey.mockResolvedValue({
			error: { message: "No passkey available" },
		});
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(result.current.errorMessage).toBe("No passkey available");
	});
	it("preserves OAuth continuation for social sign-in", async () => {
		stubLocation({
			origin: "https://app.test",
			search: OAUTH_AUTHORIZE_SEARCH,
		});
		mocks.social.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.social).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: `https://app.test/login${OAUTH_AUTHORIZE_SEARCH}`,
		});
	});
});
