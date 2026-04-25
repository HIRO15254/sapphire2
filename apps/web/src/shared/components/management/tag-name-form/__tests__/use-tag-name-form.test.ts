import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTagNameForm } from "@/shared/components/management/tag-name-form/use-tag-name-form";

describe("useTagNameForm", () => {
	it("starts with empty name when defaultName is not provided", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({ name: "" });
	});

	it("seeds the form with defaultName", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTagNameForm({ onSubmit, defaultName: "Existing" })
		);
		expect(result.current.form.state.values).toEqual({ name: "Existing" });
	});

	it("rejects empty name on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects name longer than 50 characters", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "x".repeat(51));
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("accepts name at exactly 50 characters", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "x".repeat(50));
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith("x".repeat(50));
	});

	it("calls onSubmit with the current name on valid submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "VIP");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith("VIP");
	});

	it("does not reset the form after submit (caller decides)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "VIP");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(result.current.form.state.values.name).toBe("VIP");
	});
});
