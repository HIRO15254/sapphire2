import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: { list: { queryOptions: () => ({ queryKey: ["session-list"] }) } },
	},
	trpcClient: {},
}));

import { useSummaryStatsEditForm } from "@/features/dashboard/widgets/summary-stats-widget/use-summary-stats-edit-form";
import { SUMMARY_STATS_DEFAULT_METRICS } from "@/features/dashboard/widgets/summary-stats-widget/use-summary-stats-widget";

describe("useSummaryStatsEditForm", () => {
	it("defaults from empty config: default metrics, type='all', dateRangeDays=''", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useSummaryStatsEditForm({ config: {}, onSave })
		);
		expect(result.current.form.state.values.metrics).toEqual(
			SUMMARY_STATS_DEFAULT_METRICS
		);
		expect(result.current.form.state.values.type).toBe("all");
		expect(result.current.form.state.values.dateRangeDays).toBe("");
	});

	it("seeds dateRangeDays as string when config provides a number", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useSummaryStatsEditForm({
				config: { dateRangeDays: 30, type: "tournament" },
				onSave,
			})
		);
		expect(result.current.form.state.values.dateRangeDays).toBe("30");
		expect(result.current.form.state.values.type).toBe("tournament");
	});

	it("submits metrics as-provided when non-empty, and dateRangeDays as number", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useSummaryStatsEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("metrics", ["winRate"]);
			result.current.form.setFieldValue("type", "cash_game");
			result.current.form.setFieldValue("dateRangeDays", "14");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({
			metrics: ["winRate"],
			type: "cash_game",
			dateRangeDays: 14,
		});
	});

	it("falls back to SUMMARY_STATS_DEFAULT_METRICS when metrics array is empty on submit", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useSummaryStatsEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("metrics", []);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ metrics: SUMMARY_STATS_DEFAULT_METRICS })
		);
	});

	it("submits dateRangeDays as null when field is blank", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useSummaryStatsEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDays", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ dateRangeDays: null })
		);
	});
});
