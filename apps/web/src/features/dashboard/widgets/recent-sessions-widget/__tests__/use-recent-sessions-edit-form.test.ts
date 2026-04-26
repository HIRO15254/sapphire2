import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: { list: { queryOptions: () => ({ queryKey: ["session-list"] }) } },
	},
	trpcClient: {},
}));

import { useRecentSessionsEditForm } from "@/features/dashboard/widgets/recent-sessions-widget/use-recent-sessions-edit-form";

describe("useRecentSessionsEditForm", () => {
	it("defaults from empty config: limit=5 (as string), type='all'", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useRecentSessionsEditForm({ config: {}, onSave })
		);
		expect(result.current.form.state.values).toEqual({
			limit: "5",
			type: "all",
		});
	});

	it("seeds limit and type from a valid config", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useRecentSessionsEditForm({
				config: { limit: 10, type: "cash_game" },
				onSave,
			})
		);
		expect(result.current.form.state.values).toEqual({
			limit: "10",
			type: "cash_game",
		});
	});

	it("submits parsed limit number and type", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useRecentSessionsEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("limit", "7");
			result.current.form.setFieldValue("type", "tournament");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({ limit: 7, type: "tournament" });
	});

	it("rejects submit when limit is 0 (below min 1)", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useRecentSessionsEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("limit", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});

	it("rejects submit when limit is above max 20", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useRecentSessionsEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("limit", "21");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});
});
