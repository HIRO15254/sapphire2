import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomForm } from "@/features/rooms/components/room-form/use-room-form";

type SuccessFn = (position: {
	coords: { latitude: number; longitude: number };
}) => void;
type ErrorFn = (error: { code: number; message: string }) => void;

const originalGeo = Object.getOwnPropertyDescriptor(navigator, "geolocation");
let getCurrentPosition: ReturnType<typeof vi.fn>;

beforeEach(() => {
	getCurrentPosition = vi.fn();
	Object.defineProperty(navigator, "geolocation", {
		configurable: true,
		value: { getCurrentPosition },
	});
});

afterEach(() => {
	if (originalGeo) {
		Object.defineProperty(navigator, "geolocation", originalGeo);
	} else {
		// biome-ignore lint/performance/noDelete: restoring jsdom's missing property
		delete (navigator as { geolocation?: unknown }).geolocation;
	}
	vi.restoreAllMocks();
});

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

	it("submits typed coordinates as numbers", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
			result.current.form.setFieldValue("latitude", "35.6812");
			result.current.form.setFieldValue("longitude", "139.7671");
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

	it("rejects a latitude outside [-90, 90]", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
			result.current.form.setFieldValue("latitude", "91");
			result.current.form.setFieldValue("longitude", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects a longitude outside [-180, 180]", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
			result.current.form.setFieldValue("latitude", "35");
			result.current.form.setFieldValue("longitude", "181");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects when only one coordinate is provided", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRoomForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "Room");
			result.current.form.setFieldValue("latitude", "35.6812");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe("useRoomForm — capture current location", () => {
	function fireSuccess(latitude: number, longitude: number) {
		const success = getCurrentPosition.mock.calls[0][0] as SuccessFn;
		act(() => {
			success({ coords: { latitude, longitude } });
		});
	}

	it("does not request a position until captureLocation is called", () => {
		renderHook(() => useRoomForm({ onSubmit: vi.fn() }));
		expect(getCurrentPosition).not.toHaveBeenCalled();
	});

	it("writes a captured fix into the latitude/longitude fields", async () => {
		const { result } = renderHook(() => useRoomForm({ onSubmit: vi.fn() }));
		act(() => {
			result.current.captureLocation();
		});
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		fireSuccess(35.6812, 139.7671);
		await waitFor(() => {
			expect(result.current.form.state.values.latitude).toBe("35.6812");
			expect(result.current.form.state.values.longitude).toBe("139.7671");
		});
		expect(result.current.locationStatus).toBe("granted");
	});

	it("surfaces a denied status without touching the fields", async () => {
		const { result } = renderHook(() => useRoomForm({ onSubmit: vi.fn() }));
		act(() => {
			result.current.captureLocation();
		});
		const errorCb = getCurrentPosition.mock.calls[0][1] as ErrorFn;
		act(() => {
			errorCb({ code: 1, message: "denied" });
		});
		await waitFor(() => expect(result.current.locationStatus).toBe("denied"));
		expect(result.current.form.state.values.latitude).toBe("");
		expect(result.current.form.state.values.longitude).toBe("");
	});
});
