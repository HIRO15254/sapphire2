import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	onSignOut: vi.fn(),
	useSignOut: vi.fn(),
}));

vi.mock("@/shared/hooks/use-sign-out", () => ({
	useSignOut: mocks.useSignOut,
}));

import { useSettingsPage } from "@/features/settings/pages/settings-page/use-settings-page";

describe("useSettingsPage", () => {
	beforeEach(() => {
		mocks.onSignOut.mockReset();
		mocks.useSignOut.mockReset();
		mocks.useSignOut.mockReturnValue({ onSignOut: mocks.onSignOut });
	});

	it("delegates sign-out to the shared useSignOut hook", () => {
		const { result } = renderHook(() => useSettingsPage());
		expect(mocks.useSignOut).toHaveBeenCalledTimes(1);
		expect(result.current.onSignOut).toBe(mocks.onSignOut);
	});

	it("invokes the shared handler when onSignOut is called", () => {
		const { result } = renderHook(() => useSettingsPage());
		result.current.onSignOut();
		expect(mocks.onSignOut).toHaveBeenCalledTimes(1);
	});
});
