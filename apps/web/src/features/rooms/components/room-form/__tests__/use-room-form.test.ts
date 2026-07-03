import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRoomForm } from "@/features/rooms/components/room-form/use-room-form";

describe("useRoomForm — fields", () => {
	it("starts with empty name, memo, latitude and longitude", () => {
		const { result } = renderHook(() => useRoomForm({ onSubmit: vi.fn() }));
		expect(result.current.form.state.values).toEqual({
			name: "",
			memo: "",
			latitude: "",
			longitude: "",
		});
	});

	it("seeds name and memo from defaultValues", () => {
		const { result } = renderHook(() =>
			useRoomForm({
				onSubmit: vi.fn(),
				defaultValues: { name: "Room A", memo: "hello" },
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Room A",
			memo: "hello",
			latitude: "",
			longitude: "",
		});
	});

	it("seeds latitude/longitude from numeric defaultValues as strings", () => {
		const { result } = renderHook(() =>
			useRoomForm({
				onSubmit: vi.fn(),
				defaultValues: {
					name: "Room A",
					latitude: 35.6812,
					longitude: 139.7671,
				},
			})
		);
		expect(result.current.form.state.values.latitude).toBe("35.6812");
		expect(result.current.form.state.values.longitude).toBe("139.7671");
	});

	it("treats null defaultValue coordinates as empty fields", () => {
		const { result } = renderHook(() =>
			useRoomForm({
				onSubmit: vi.fn(),
				defaultValues: { name: "Room A", latitude: null, longitude: null },
			})
		);
		expect(result.current.form.state.values.latitude).toBe("");
		expect(result.current.form.state.values.longitude).toBe("");
	});
});

describe("useRoomForm — setCoords", () => {
	it("sets both latitude and longitude fields from a coordinate pair", () => {
		const { result } = renderHook(() => useRoomForm({ onSubmit: vi.fn() }));
		act(() => {
			result.current.setCoords({ latitude: 35.6812, longitude: 139.7671 });
		});
		expect(result.current.form.state.values.latitude).toBe("35.6812");
		expect(result.current.form.state.values.longitude).toBe("139.7671");
	});

	it("clears both fields when passed null", () => {
		const { result } = renderHook(() =>
			useRoomForm({
				onSubmit: vi.fn(),
				defaultValues: { name: "Room", latitude: 1, longitude: 2 },
			})
		);
		act(() => {
			result.current.setCoords(null);
		});
		expect(result.current.form.state.values.latitude).toBe("");
		expect(result.current.form.state.values.longitude).toBe("");
	});
});

describe("useRoomForm — submit", () => {
	it("rejects submit with empty name", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits memo and coordinates as undefined when all are empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Room",
			memo: undefined,
			latitude: undefined,
			longitude: undefined,
		});
	});

	it("submits coordinates set via setCoords as numbers", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
			result.current.setCoords({ latitude: 35.6812, longitude: 139.7671 });
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Room",
			memo: undefined,
			latitude: 35.6812,
			longitude: 139.7671,
		});
	});

	it("submits undefined coordinates after setCoords(null)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useRoomForm({
				onSubmit,
				defaultValues: { name: "Room", latitude: 1, longitude: 2 },
			})
		);
		act(() => {
			result.current.setCoords(null);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Room",
			memo: undefined,
			latitude: undefined,
			longitude: undefined,
		});
	});
});
