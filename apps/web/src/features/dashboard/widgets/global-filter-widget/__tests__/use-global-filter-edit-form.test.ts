import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalFilterEditForm } from "@/features/dashboard/widgets/global-filter-widget/use-global-filter-edit-form";

describe("useGlobalFilterEditForm", () => {
	it("defaults from empty config: type='all', dateRangeDays=''", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({ config: {}, onSave })
		);
		expect(result.current.form.state.values.type).toBe("all");
		expect(result.current.form.state.values.dateRangeDays).toBe("");
	});

	it("seeds dateRangeDays as string when config provides a number", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({
				config: { type: "tournament", dateRangeDays: 14 },
				onSave,
			})
		);
		expect(result.current.form.state.values.type).toBe("tournament");
		expect(result.current.form.state.values.dateRangeDays).toBe("14");
	});

	it("submits type and dateRangeDays as a number", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("type", "cash_game");
			result.current.form.setFieldValue("dateRangeDays", "30");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith({
			type: "cash_game",
			dateRangeDays: 30,
		});
	});

	it("submits dateRangeDays as null when blank", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("type", "tournament");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({
			type: "tournament",
			dateRangeDays: null,
		});
	});

	it("submits dateRangeDays as null when whitespace only", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({ config: {}, onSave })
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

	it("rejects dateRangeDays below 1 (validation)", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDays", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});

	it("rejects dateRangeDays above 3650 (validation)", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useGlobalFilterEditForm({ config: {}, onSave })
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDays", "9999");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});
});
