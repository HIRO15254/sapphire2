import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGameVariantForm } from "@/features/game-variants/components/game-variant-form/use-game-variant-form";

describe("useGameVariantForm", () => {
	it("starts with an empty name and empty blind labels when no defaults", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({
			name: "",
			blindLabel1: "",
			blindLabel2: "",
			blindLabel3: "",
		});
	});

	it("seeds the form from defaultValues", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useGameVariantForm({
				onSubmit,
				defaultValues: {
					name: "PLO5",
					blindLabel1: "SB",
					blindLabel2: "BB",
					blindLabel3: "Straddle",
				},
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "PLO5",
			blindLabel1: "SB",
			blindLabel2: "BB",
			blindLabel3: "Straddle",
		});
	});

	it("falls back null defaultValues blind labels to empty strings", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useGameVariantForm({
				onSubmit,
				defaultValues: {
					name: "Short Deck",
					blindLabel1: "Button blind",
					blindLabel2: null,
					blindLabel3: null,
				},
			})
		);
		expect(result.current.form.state.values.blindLabel2).toBe("");
		expect(result.current.form.state.values.blindLabel3).toBe("");
	});

	it("falls back omitted defaultValues blind labels to empty strings", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useGameVariantForm({ onSubmit, defaultValues: { name: "Stud" } })
		);
		expect(result.current.form.state.values).toEqual({
			name: "Stud",
			blindLabel1: "",
			blindLabel2: "",
			blindLabel3: "",
		});
	});

	describe("name validation", () => {
		it("rejects an empty name on submit", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("rejects a whitespace-only name on submit", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "   ");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("rejects a name longer than 50 characters", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "A".repeat(51));
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("accepts the 50-character boundary", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			const name = "A".repeat(50);
			act(() => {
				result.current.form.setFieldValue("name", name);
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name,
				blindLabel1: null,
				blindLabel2: null,
				blindLabel3: null,
			});
		});

		it("accepts the 1-character boundary", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "X");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "X",
				blindLabel1: null,
				blindLabel2: null,
				blindLabel3: null,
			});
		});

		it("trims surrounding whitespace from the name before submitting", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "  PLO  ");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "PLO",
				blindLabel1: null,
				blindLabel2: null,
				blindLabel3: null,
			});
		});
	});

	describe("blind label validation", () => {
		it("submits empty blind labels as null", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "NLH",
				blindLabel1: null,
				blindLabel2: null,
				blindLabel3: null,
			});
		});

		it("submits whitespace-only blind labels as null", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				result.current.form.setFieldValue("blindLabel1", "   ");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "NLH",
				blindLabel1: null,
				blindLabel2: null,
				blindLabel3: null,
			});
		});

		it("submits non-empty blind labels trimmed", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				result.current.form.setFieldValue("blindLabel1", "  SB  ");
				result.current.form.setFieldValue("blindLabel2", "BB");
				result.current.form.setFieldValue("blindLabel3", "Straddle");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "NLH",
				blindLabel1: "SB",
				blindLabel2: "BB",
				blindLabel3: "Straddle",
			});
		});

		it("rejects a blind label longer than 20 characters", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				result.current.form.setFieldValue("blindLabel1", "A".repeat(21));
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("accepts the 20-character boundary for a blind label", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			const label = "A".repeat(20);
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				result.current.form.setFieldValue("blindLabel1", label);
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "NLH",
				blindLabel1: label,
				blindLabel2: null,
				blindLabel3: null,
			});
		});

		it("accepts a 20-character boundary post-trim even when pre-trim is longer", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				// pre-trim length 24, post-trim length 20 → must pass max(20)
				result.current.form.setFieldValue(
					"blindLabel1",
					`  ${"A".repeat(20)}  `
				);
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith({
				name: "NLH",
				blindLabel1: "A".repeat(20),
				blindLabel2: null,
				blindLabel3: null,
			});
		});

		it("rejects when only blindLabel2 exceeds the max length", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				result.current.form.setFieldValue("blindLabel2", "A".repeat(21));
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("rejects when only blindLabel3 exceeds the max length", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useGameVariantForm({ onSubmit }));
			act(() => {
				result.current.form.setFieldValue("name", "NLH");
				result.current.form.setFieldValue("blindLabel3", "A".repeat(21));
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});
});
