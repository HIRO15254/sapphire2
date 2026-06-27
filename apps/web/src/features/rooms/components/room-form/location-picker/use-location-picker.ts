import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/shared/hooks/use-geolocation";
import { trpcClient } from "@/utils/trpc";

export interface Coords {
	latitude: number;
	longitude: number;
}

interface PlaceResult {
	address: string;
	latitude: number;
	longitude: number;
	name: string;
}

interface UseLocationPickerArgs {
	latitude: number | null;
	longitude: number | null;
	onCoordsChange: (coords: Coords | null) => void;
}

/**
 * Drives the room location picker: place-name search, Google Maps link paste
 * and device GPS, all funnelling into a single `onCoordsChange`. The canonical
 * coordinates live in the parent form; this hook only sets them.
 */
export function useLocationPicker({
	latitude,
	longitude,
	onCoordsChange,
}: UseLocationPickerArgs) {
	const [query, setQuery] = useState("");
	const [link, setLink] = useState("");

	// Keep the latest callback in a ref so the GPS effect fires only on a new
	// fix, not whenever the parent re-creates onCoordsChange.
	const onCoordsChangeRef = useRef(onCoordsChange);
	onCoordsChangeRef.current = onCoordsChange;

	const {
		request: captureLocation,
		coords: gpsCoords,
		status: gpsStatus,
	} = useGeolocation({ enabled: false });

	useEffect(() => {
		if (gpsCoords) {
			onCoordsChangeRef.current(gpsCoords);
		}
	}, [gpsCoords]);

	const searchMutation = useMutation({
		mutationFn: (q: string): Promise<PlaceResult[]> =>
			trpcClient.location.search.mutate({ query: q }),
	});

	const resolveMutation = useMutation({
		mutationFn: (url: string): Promise<Coords> =>
			trpcClient.location.resolveLink.mutate({ url }),
	});

	const handleSearch = () => {
		const trimmed = query.trim();
		if (trimmed) {
			searchMutation.mutate(trimmed);
		}
	};

	const pickResult = (result: PlaceResult) => {
		onCoordsChange({
			latitude: result.latitude,
			longitude: result.longitude,
		});
		searchMutation.reset();
		setQuery("");
	};

	const handleResolveLink = () => {
		const trimmed = link.trim();
		if (trimmed) {
			resolveMutation.mutate(trimmed, {
				onSuccess: (coords) => {
					onCoordsChange(coords);
					setLink("");
				},
			});
		}
	};

	const clearLocation = () => {
		onCoordsChange(null);
	};

	return {
		query,
		setQuery,
		link,
		setLink,
		handleSearch,
		results: searchMutation.data ?? [],
		isSearching: searchMutation.isPending,
		searchError: searchMutation.error?.message ?? null,
		pickResult,
		handleResolveLink,
		isResolving: resolveMutation.isPending,
		resolveError: resolveMutation.error?.message ?? null,
		captureLocation,
		gpsStatus,
		clearLocation,
		hasLocation: latitude !== null && longitude !== null,
		latitude,
		longitude,
	};
}
