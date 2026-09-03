import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/shared/hooks/use-geolocation";
import { trpcClient } from "@/utils/trpc";
import { isGoogleMapsUrl } from "./maps-url";

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
	initialQuery?: string;
	latitude: number | null;
	longitude: number | null;
	onCoordsChange: (coords: Coords | null) => void;
}

export function useLocationPicker({
	initialQuery,
	latitude,
	longitude,
	onCoordsChange,
}: UseLocationPickerArgs) {
	const [query, setQuery] = useState(initialQuery ?? "");
	const [link, setLink] = useState("");

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

	const linkTrimmed = link.trim();
	const isLinkValid = linkTrimmed !== "" && isGoogleMapsUrl(linkTrimmed);
	const linkError =
		linkTrimmed !== "" && !isGoogleMapsUrl(linkTrimmed)
			? "Enter a valid Google Maps URL"
			: (resolveMutation.error?.message ?? null);

	const handleResolveLink = () => {
		if (!isLinkValid) {
			return;
		}
		resolveMutation.mutate(linkTrimmed, {
			onSuccess: (coords) => {
				onCoordsChange(coords);
				setLink("");
			},
		});
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
		isLinkValid,
		linkError,
		captureLocation,
		gpsStatus,
		clearLocation,
		hasLocation: latitude !== null && longitude !== null,
		latitude,
		longitude,
	};
}
