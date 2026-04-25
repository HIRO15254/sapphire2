import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlayerForm } from "@/features/players/components/player-form/use-player-form";

describe("usePlayerForm", () => {
	it("defaults to empty name, null memo, and empty tags", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => usePlayerForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({
			name: "",
			memo: null,
			tags: [],
		});
	});

	it("seeds the form from defaults", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			usePlayerForm({
				defaultValues: { name: "Alice" },
				defaultMemo: "memo",
				defaultTags: [{ id: "t1", name: "VIP", color: "gold" }],
				onSubmit,
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Alice",
			memo: "memo",
			tags: [{ id: "t1", name: "VIP", color: "gold" }],
		});
	});

	it("rejects submit with empty name", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => usePlayerForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects submit with name longer than 100 characters", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => usePlayerForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "x".repeat(101));
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with tagIds undefined when no tags selected", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => usePlayerForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Bob");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Bob",
			memo: null,
			tagIds: undefined,
		});
	});

	it("submits with tagIds populated when tags are selected", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			usePlayerForm({
				defaultTags: [
					{ id: "t1", name: "VIP", color: "gold" },
					{ id: "t2", name: "Regular", color: "blue" },
				],
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("name", "Carol");
			result.current.form.setFieldValue("memo", "notes");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Carol",
			memo: "notes",
			tagIds: ["t1", "t2"],
		});
	});
});
