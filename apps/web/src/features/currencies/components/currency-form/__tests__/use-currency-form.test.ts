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

	it("rejects a unit longer than 4 characters", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Gold");
			result.current.form.setFieldValue("unit", "ABCDE");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects a unit containing multi-byte (non-ASCII) characters", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "JPY");
			result.current.form.setFieldValue("unit", "¥");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("accepts the 4-character boundary", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Pesos");
			result.current.form.setFieldValue("unit", "MXN$");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Pesos", unit: "MXN$" });
	});

	it("trims whitespace-only unit to undefined", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Chips");
			result.current.form.setFieldValue("unit", "    ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Chips", unit: undefined });
	});

	it("trims surrounding whitespace before submitting the unit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Gold");
			result.current.form.setFieldValue("unit", "  g  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Gold", unit: "g" });
	});

	it("accepts ' AB ' (4-char post-trim) at the length boundary", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "X");
			// pre-trim length 6, post-trim length 2 → must pass max(4)
			result.current.form.setFieldValue("unit", "  AB  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "X", unit: "AB" });
	});
});
