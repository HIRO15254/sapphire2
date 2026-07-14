import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	onNeedRefresh: undefined as undefined | ((value: boolean) => void),
	toastInfo: vi.fn(),
	updateSW: vi.fn(),
}));

vi.mock("@/shared/lib/pwa-register", () => ({
	registerSW: (options: { onNeedRefresh: (value: boolean) => void }) => {
		mocks.onNeedRefresh = options.onNeedRefresh;
		return mocks.updateSW;
	},
}));

vi.mock("sonner", () => ({
	toast: { info: mocks.toastInfo },
}));

import { usePwaUpdate } from "@/shared/hooks/use-pwa-update";

describe("usePwaUpdate", () => {
	it("offers a reload action only after an update is available", () => {
		renderHook(() => usePwaUpdate());
		expect(mocks.toastInfo).not.toHaveBeenCalled();

		act(() => mocks.onNeedRefresh?.(true));

		expect(mocks.toastInfo).toHaveBeenCalledTimes(1);
		expect(mocks.toastInfo).toHaveBeenCalledWith(
			"An update is available",
			expect.objectContaining({
				action: expect.objectContaining({ label: "Reload" }),
			})
		);
		const options = mocks.toastInfo.mock.calls[0]?.[1] as {
			action: { onClick: () => void };
		};
		options.action.onClick();
		expect(mocks.updateSW).toHaveBeenCalledWith(true);
	});
});
