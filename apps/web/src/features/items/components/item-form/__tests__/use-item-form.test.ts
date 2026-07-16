import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useCurrencies: vi.fn(),
}));

vi.mock("@/features/currencies/hooks/use-currencies", () => ({
	useCurrencies: hoisted.useCurrencies,
}));

import { useItemForm } from "@/features/items/components/item-form/use-item-form";

const CURRENCIES = [
	{ id: "c1", name: "USD", unit: "$", isFavorite: false },
	{ id: "c2", name: "Chips", unit: null, isFavorite: true },
];

describe("useItemForm", () => {
	beforeEach(() => {
		hoisted.useCurrencies.mockReturnValue({
			currencies: CURRENCIES,
			isLoading: false,
		});
	});

	it("passes null to useCurrencies (the form never expands a currency row)", () => {
		renderHook(() => useItemForm({ onSubmit: vi.fn() }));
		expect(hoisted.useCurrencies).toHaveBeenCalledWith(null);
	});

	it("exposes the user's currencies for the select", () => {
		const { result } = renderHook(() => useItemForm({ onSubmit: vi.fn() }));
		expect(result.current.currencies).toEqual(CURRENCIES);
	});

	it("starts with empty name/currencyId/unitValue and null description when no defaults", () => {
		const { result } = renderHook(() => useItemForm({ onSubmit: vi.fn() }));
		expect(result.current.form.state.values).toEqual({
			name: "",
			currencyId: "",
			unitValue: "",
			description: null,
		});
	});

	it("seeds the form from defaultValues (unitValue stringified)", () => {
		const { result } = renderHook(() =>
			useItemForm({
				onSubmit: vi.fn(),
				defaultValues: {
					name: "Ticket",
					currencyId: "c1",
					unitValue: 100,
					description: "<p>note</p>",
				},
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Ticket",
			currencyId: "c1",
			unitValue: "100",
			description: "<p>note</p>",
		});
	});

	it("seeds a zero default unitValue as '0' (not empty)", () => {
		const { result } = renderHook(() =>
			useItemForm({
				onSubmit: vi.fn(),
				defaultValues: { name: "Free", currencyId: "c1", unitValue: 0 },
			})
		);
		expect(result.current.form.state.values.unitValue).toBe("0");
	});

	it("defaults description to null when defaultValues omits it", () => {
		const { result } = renderHook(() =>
			useItemForm({
				onSubmit: vi.fn(),
				defaultValues: { name: "Ticket", currencyId: "c1", unitValue: 1 },
			})
		);
		expect(result.current.form.state.values.description).toBeNull();
	});

	it("rejects an empty form on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects an empty name", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("currencyId", "c1");
			result.current.form.setFieldValue("unitValue", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects an empty currencyId (currency is required for an item)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Ticket");
			result.current.form.setFieldValue("unitValue", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects an empty unitValue", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Ticket");
			result.current.form.setFieldValue("currencyId", "c1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("accepts a unitValue of 0 (min boundary)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Freebie");
			result.current.form.setFieldValue("currencyId", "c1");
			result.current.form.setFieldValue("unitValue", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Freebie",
			currencyId: "c1",
			unitValue: 0,
			description: null,
		});
	});

	it("rejects a negative unitValue (1 below the min boundary)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Ticket");
			result.current.form.setFieldValue("currencyId", "c1");
			result.current.form.setFieldValue("unitValue", "-1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it.each([
		"100.5",
		"0.5",
		"NaN",
		"Infinity",
		"abc",
	])("rejects the non-integer unitValue %s", async (unitValue) => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Ticket");
			result.current.form.setFieldValue("currencyId", "c1");
			result.current.form.setFieldValue("unitValue", unitValue);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits the parsed integer unitValue and the selected currency", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Ticket");
			result.current.form.setFieldValue("currencyId", "c2");
			result.current.form.setFieldValue("unitValue", "1500");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Ticket",
			currencyId: "c2",
			unitValue: 1500,
			description: null,
		});
	});

	it("submits the rich-text description html as-is", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useItemForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Ticket");
			result.current.form.setFieldValue("currencyId", "c1");
			result.current.form.setFieldValue("unitValue", "10");
			result.current.form.setFieldValue("description", "<p>10k GTD entry</p>");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Ticket",
			currencyId: "c1",
			unitValue: 10,
			description: "<p>10k GTD entry</p>",
		});
	});

	it("seeds the description and submits it back unchanged when untouched", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useItemForm({
				onSubmit,
				defaultValues: {
					name: "Ticket",
					currencyId: "c1",
					unitValue: 5,
					description: "<p>kept</p>",
				},
			})
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Ticket",
			currencyId: "c1",
			unitValue: 5,
			description: "<p>kept</p>",
		});
	});
});
