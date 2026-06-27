import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trpcMocks = vi.hoisted(() => ({
	search: vi.fn(),
	resolveLink: vi.fn(),
}));
const geoMock = vi.hoisted(() => ({
	coords: null as { latitude: number; longitude: number } | null,
	request: vi.fn(),
	status: "idle" as string,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {},
	trpcClient: {
		location: {
			search: { mutate: trpcMocks.search },
			resolveLink: { mutate: trpcMocks.resolveLink },
		},
	},
}));

vi.mock("@/shared/hooks/use-geolocation", () => ({
	useGeolocation: () => ({
		coords: geoMock.coords,
		status: geoMock.status,
		error: null,
		request: geoMock.request,
	}),
}));

import { useLocationPicker } from "@/features/rooms/components/room-form/location-picker/use-location-picker";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

function renderPicker(
	props: {
		latitude?: number | null;
		longitude?: number | null;
		onCoordsChange?: (
			c: { latitude: number; longitude: number } | null
		) => void;
	} = {}
) {
	const onCoordsChange = props.onCoordsChange ?? vi.fn();
	const utils = renderHook(
		() =>
			useLocationPicker({
				latitude: props.latitude ?? null,
				longitude: props.longitude ?? null,
				onCoordsChange,
			}),
		{ wrapper: makeWrapper(createClient()) }
	);
	return { ...utils, onCoordsChange };
}

describe("useLocationPicker", () => {
	beforeEach(() => {
		trpcMocks.search.mockReset();
		trpcMocks.resolveLink.mockReset();
		geoMock.coords = null;
		geoMock.request.mockReset();
		geoMock.status = "idle";
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("place search", () => {
		it("searches with the trimmed query and exposes results", async () => {
			trpcMocks.search.mockResolvedValue([
				{ name: "Casino", address: "Tokyo", latitude: 35.6, longitude: 139.7 },
			]);
			const { result } = renderPicker();
			act(() => result.current.setQuery("  casino  "));
			act(() => result.current.handleSearch());
			await waitFor(() => expect(result.current.results).toHaveLength(1));
			expect(trpcMocks.search).toHaveBeenCalledWith({ query: "casino" });
		});

		it("does not search when the query is blank", () => {
			const { result } = renderPicker();
			act(() => result.current.setQuery("   "));
			act(() => result.current.handleSearch());
			expect(trpcMocks.search).not.toHaveBeenCalled();
		});

		it("picking a result reports its coordinates and clears the search", async () => {
			trpcMocks.search.mockResolvedValue([
				{ name: "Casino", address: "Tokyo", latitude: 35.6, longitude: 139.7 },
			]);
			const { result, onCoordsChange } = renderPicker();
			act(() => result.current.setQuery("casino"));
			act(() => result.current.handleSearch());
			await waitFor(() => expect(result.current.results).toHaveLength(1));
			act(() => result.current.pickResult(result.current.results[0]));
			expect(onCoordsChange).toHaveBeenCalledWith({
				latitude: 35.6,
				longitude: 139.7,
			});
			await waitFor(() => expect(result.current.results).toHaveLength(0));
			expect(result.current.query).toBe("");
		});

		it("surfaces a search error", async () => {
			trpcMocks.search.mockRejectedValue(new Error("search boom"));
			const { result } = renderPicker();
			act(() => result.current.setQuery("casino"));
			act(() => result.current.handleSearch());
			await waitFor(() =>
				expect(result.current.searchError).toBe("search boom")
			);
		});
	});

	describe("resolve link", () => {
		it("resolves a link and reports the coordinates", async () => {
			trpcMocks.resolveLink.mockResolvedValue({
				latitude: 35.6812,
				longitude: 139.7671,
			});
			const { result, onCoordsChange } = renderPicker();
			act(() => result.current.setLink("https://maps.app.goo.gl/abc"));
			act(() => result.current.handleResolveLink());
			await waitFor(() =>
				expect(onCoordsChange).toHaveBeenCalledWith({
					latitude: 35.6812,
					longitude: 139.7671,
				})
			);
			expect(trpcMocks.resolveLink).toHaveBeenCalledWith({
				url: "https://maps.app.goo.gl/abc",
			});
			await waitFor(() => expect(result.current.link).toBe(""));
		});

		it("does not resolve when the link is blank", () => {
			const { result } = renderPicker();
			act(() => result.current.setLink("  "));
			act(() => result.current.handleResolveLink());
			expect(trpcMocks.resolveLink).not.toHaveBeenCalled();
		});

		it("surfaces a resolve error and does not report coordinates", async () => {
			trpcMocks.resolveLink.mockRejectedValue(new Error("bad link"));
			const { result, onCoordsChange } = renderPicker();
			act(() => result.current.setLink("https://maps.app.goo.gl/x"));
			act(() => result.current.handleResolveLink());
			await waitFor(() => expect(result.current.resolveError).toBe("bad link"));
			expect(onCoordsChange).not.toHaveBeenCalled();
		});
	});

	describe("gps + clear + hasLocation", () => {
		it("reports a GPS fix through onCoordsChange", () => {
			geoMock.coords = { latitude: 1.5, longitude: 2.5 };
			const { onCoordsChange } = renderPicker();
			expect(onCoordsChange).toHaveBeenCalledWith({
				latitude: 1.5,
				longitude: 2.5,
			});
		});

		it("captureLocation triggers the geolocation request", () => {
			const { result } = renderPicker();
			act(() => result.current.captureLocation());
			expect(geoMock.request).toHaveBeenCalledTimes(1);
		});

		it("clearLocation reports null", () => {
			const { result, onCoordsChange } = renderPicker({
				latitude: 35.6,
				longitude: 139.7,
			});
			act(() => result.current.clearLocation());
			expect(onCoordsChange).toHaveBeenCalledWith(null);
		});

		it("reflects hasLocation from the props", () => {
			const withCoords = renderPicker({ latitude: 35.6, longitude: 139.7 });
			expect(withCoords.result.current.hasLocation).toBe(true);
			const without = renderPicker();
			expect(without.result.current.hasLocation).toBe(false);
		});
	});
});
