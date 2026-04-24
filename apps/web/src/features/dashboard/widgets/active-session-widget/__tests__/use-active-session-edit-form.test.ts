import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			list: { queryOptions: () => ({ queryKey: ["live-cash"] }) },
		},
		liveTournamentSession: {
			list: { queryOptions: () => ({ queryKey: ["live-tournament"] }) },
		},
	},
	trpcClient: {},
}));

import { useActiveSessionEditForm } from "@/features/dashboard/widgets/active-session-widget/use-active-session-edit-form";

describe("useActiveSessionEditForm", () => {
	it("defaults sessionType to 'all' when config is empty", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({ config: {}, onSave })
		);
		expect(result.current.form.state.values.sessionType).toBe("all");
	});

	it("seeds sessionType from a valid config value", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({
				config: { sessionType: "cash_game" },
				onSave,
			})
		);
		expect(result.current.form.state.values.sessionType).toBe("cash_game");
	});

	it("falls back to 'all' when config.sessionType is not a known value", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({
				config: { sessionType: "garbage" },
				onSave,
			})
		);
		expect(result.current.form.state.values.sessionType).toBe("all");
	});

	it("submits by calling onSave with the current sessionType", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("sessionType", "tournament");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({ sessionType: "tournament" });
	});
});
