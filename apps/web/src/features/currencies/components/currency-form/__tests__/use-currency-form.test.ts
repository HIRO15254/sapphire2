import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCurrencyForm } from "@/features/currencies/components/currency-form/use-currency-form";

describe("useCurrencyForm", () => {
	it("starts with empty name and unit and null description when no defaults", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({
			name: "",
			unit: "",
			description: null,
		});
	});

	it("seeds the form from defaultValues", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCurrencyForm({
				onSubmit,
				defaultValues: {
					name: "Chips",
					unit: "pt",
					description: "<p>note</p>",
				},
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Chips",
			unit: "pt",
			description: "<p>note</p>",
		});
	});

	it("defaults description to null when defaultValues omits it", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCurrencyForm({ onSubmit, defaultValues: { name: "Chips" } })
		);
		expect(result.current.form.state.values.description).toBeNull();
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
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Gold",
			unit: undefined,
			description: null,
		});
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
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Gold",
			unit: "g",
			description: null,
		});
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
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Pesos",
			unit: "MXN$",
			description: null,
		});
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
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Chips",
			unit: undefined,
			description: null,
		});
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
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Gold",
			unit: "g",
			description: null,
		});
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
		expect(onSubmit).toHaveBeenCalledWith({
			name: "X",
			unit: "AB",
			description: null,
		});
	});

	it("submits the rich-text description html as-is", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Chips");
			result.current.form.setFieldValue(
				"description",
				"<p>Weekday game chips</p>"
			);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Chips",
			unit: undefined,
			description: "<p>Weekday game chips</p>",
		});
	});

	it("seeds the description and submits it back unchanged when untouched", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCurrencyForm({
				onSubmit,
				defaultValues: { name: "Chips", description: "<p>kept</p>" },
			})
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Chips",
			unit: undefined,
			description: "<p>kept</p>",
		});
	});
});
