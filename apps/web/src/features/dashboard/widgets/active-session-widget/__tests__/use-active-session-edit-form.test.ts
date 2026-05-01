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
	it("defaults type to 'all' when config is empty", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({ config: {}, onSave })
		);
		expect(result.current.form.state.values.type).toBe("all");
	});

	it("seeds type from a valid config value", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({
				config: { type: "cash_game" },
				onSave,
			})
		);
		expect(result.current.form.state.values.type).toBe("cash_game");
	});

	it("seeds type from a legacy sessionType key for backward compat", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({
				config: { sessionType: "tournament" },
				onSave,
			})
		);
		expect(result.current.form.state.values.type).toBe("tournament");
	});

	it("prefers `type` over legacy `sessionType` when both are present", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({
				config: { type: "cash_game", sessionType: "tournament" },
				onSave,
			})
		);
		expect(result.current.form.state.values.type).toBe("cash_game");
	});

	it("falls back to 'all' when config.type is not a known value", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({
				config: { type: "garbage" },
				onSave,
			})
		);
		expect(result.current.form.state.values.type).toBe("all");
	});

	it("submits by calling onSave with the current type", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useActiveSessionEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("type", "tournament");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith({ type: "tournament" });
	});
});
