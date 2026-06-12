import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: mocks.signOut,
	},
}));

import { useSettingsPage } from "@/features/settings/pages/settings-page/use-settings-page";

describe("useSettingsPage", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.signOut.mockReset();
	});

	it("onSignOut calls authClient.signOut exactly once", () => {
		const { result } = renderHook(() => useSettingsPage());
		result.current.onSignOut();
		expect(mocks.signOut).toHaveBeenCalledTimes(1);
	});

	it("does not navigate before sign-out succeeds", () => {
		const { result } = renderHook(() => useSettingsPage());
		result.current.onSignOut();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("navigates to the public home page when sign-out succeeds", () => {
		const { result } = renderHook(() => useSettingsPage());
		result.current.onSignOut();
		const fetchOptions = mocks.signOut.mock.calls[0][0]?.fetchOptions as {
			onSuccess: () => void;
		};
		fetchOptions.onSuccess();
		expect(mocks.navigate).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenNthCalledWith(1, { to: "/" });
	});
});
