import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStoreForm } from "@/features/stores/components/store-form/use-store-form";

describe("useStoreForm", () => {
	it("starts with empty name and memo", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useStoreForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({ name: "", memo: "" });
	});

	it("seeds form from defaultValues", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useStoreForm({
				onSubmit,
				defaultValues: { name: "Store A", memo: "hello" },
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Store A",
			memo: "hello",
		});
	});

	it("rejects submit with empty name", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useStoreForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with memo=undefined when memo is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useStoreForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Store");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Store", memo: undefined });
	});

	it("submits with memo preserved when memo is non-empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useStoreForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Store");
			result.current.form.setFieldValue("memo", "hi");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Store", memo: "hi" });
	});
});
