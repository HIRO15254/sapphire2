import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRoomForm } from "@/features/rooms/components/room-form/use-room-form";

describe("useRoomForm", () => {
	it("starts with empty name and memo", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({ name: "", memo: "" });
	});

	it("seeds form from defaultValues", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useRoomForm({
				onSubmit,
				defaultValues: { name: "Room A", memo: "hello" },
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Room A",
			memo: "hello",
		});
	});

	it("rejects submit with empty name", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with memo=undefined when memo is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Room", memo: undefined });
	});

	it("submits with memo preserved when memo is non-empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
			result.current.form.setFieldValue("memo", "hi");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ name: "Room", memo: "hi" });
	});
});
