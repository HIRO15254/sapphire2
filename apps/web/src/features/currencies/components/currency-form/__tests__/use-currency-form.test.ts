import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCurrencyForm } from "@/features/currencies/components/currency-form/use-currency-form";

describe("useCurrencyForm", () => {
	it("starts with empty name and unit when no defaults", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({ name: "", unit: "" });
	});

	it("seeds the form from defaultValues", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCurrencyForm({
				onSubmit,
				defaultValues: { name: "Chips", unit: "pt" },
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Chips",
			unit: "pt",
		});
	});

	it("falls back unit to empty string when defaultValues.unit is undefined", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCurrencyForm({ onSubmit, defaultValues: { name: "Chips" } })
		);
		expect(result.current.form.state.values.unit).toBe("");
	});

	it("rejects empty name on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with unit converted to undefined when unit is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Gold");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Gold", unit: undefined });
	});

	it("submits with unit preserved when unit is non-empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Gold");
			result.current.form.setFieldValue("unit", "g");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Gold", unit: "g" });
	});
});
