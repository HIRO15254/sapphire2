import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGeolocation } from "@/shared/hooks/use-geolocation";

type SuccessFn = (position: {
	coords: { latitude: number; longitude: number };
}) => void;
type ErrorFn = (error: { code: number; message: string }) => void;

const originalGeo = Object.getOwnPropertyDescriptor(navigator, "geolocation");
let getCurrentPosition: ReturnType<typeof vi.fn>;

function setGeolocation(value: unknown) {
	Object.defineProperty(navigator, "geolocation", {
		configurable: true,
		value,
	});
}

function fireSuccess(latitude: number, longitude: number) {
	const success = getCurrentPosition.mock.calls[0][0] as SuccessFn;
	act(() => {
		success({ coords: { latitude, longitude } });
	});
}

function fireError(code: number, message = "geo error") {
	const errorCb = getCurrentPosition.mock.calls[0][1] as ErrorFn;
	act(() => {
		errorCb({ code, message });
	});
}

beforeEach(() => {
	getCurrentPosition = vi.fn();
	setGeolocation({ getCurrentPosition });
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

describe("useGeolocation", () => {
	it("stays idle and does not request when disabled", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: false }));
		expect(result.current.status).toBe("idle");
		expect(result.current.coords).toBeNull();
		expect(getCurrentPosition).not.toHaveBeenCalled();
	});

	it("requests a position once when enabled", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: true }));
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		expect(result.current.status).toBe("prompting");
	});

	it("sets coords and granted status on success", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: true }));
		fireSuccess(35.6812, 139.7671);
		expect(result.current.status).toBe("granted");
		expect(result.current.coords).toEqual({
			latitude: 35.6812,
			longitude: 139.7671,
		});
		expect(result.current.error).toBeNull();
	});

	it("maps permission-denied (code 1) to denied with no coords", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: true }));
		fireError(1, "User denied Geolocation");
		expect(result.current.status).toBe("denied");
		expect(result.current.coords).toBeNull();
		expect(result.current.error).toBe("User denied Geolocation");
	});

	it("maps position-unavailable (code 2) to unavailable", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: true }));
		fireError(2);
		expect(result.current.status).toBe("unavailable");
		expect(result.current.coords).toBeNull();
	});

	it("maps timeout (code 3) to unavailable", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: true }));
		fireError(3);
		expect(result.current.status).toBe("unavailable");
	});

	it("reports unavailable without throwing when geolocation is absent", () => {
		setGeolocation(undefined);
		const { result } = renderHook(() => useGeolocation({ enabled: true }));
		expect(result.current.status).toBe("unavailable");
		expect(result.current.coords).toBeNull();
	});

	it("does not re-request on re-render while enabled stays true", () => {
		const { rerender } = renderHook(
			({ enabled }) => useGeolocation({ enabled }),
			{ initialProps: { enabled: true } }
		);
		rerender({ enabled: true });
		rerender({ enabled: true });
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
	});

	it("re-requests after the dialog is closed and reopened", () => {
		const { rerender } = renderHook(
			({ enabled }) => useGeolocation({ enabled }),
			{ initialProps: { enabled: true } }
		);
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		rerender({ enabled: false });
		rerender({ enabled: true });
		expect(getCurrentPosition).toHaveBeenCalledTimes(2);
	});

	it("requests imperatively via request() even when disabled", () => {
		const { result } = renderHook(() => useGeolocation({ enabled: false }));
		expect(getCurrentPosition).not.toHaveBeenCalled();
		act(() => {
			result.current.request();
		});
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
		fireSuccess(10, 20);
		expect(result.current.coords).toEqual({ latitude: 10, longitude: 20 });
		expect(result.current.status).toBe("granted");
	});
});
