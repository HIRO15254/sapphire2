import { useCallback, useEffect, useRef, useState } from "react";

export interface GeolocationCoords {
	latitude: number;
	longitude: number;
}

export type GeolocationStatus =
	| "idle"
	| "prompting"
	| "granted"
	| "denied"
	| "unavailable";

interface UseGeolocationOptions {
	enabled: boolean;
}

interface UseGeolocationResult {
	coords: GeolocationCoords | null;
	error: string | null;
	request: () => void;
	status: GeolocationStatus;
}

const POSITION_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	timeout: 10_000,
	maximumAge: 60_000,
};

const PERMISSION_DENIED = 1;

export function useGeolocation({
	enabled,
}: UseGeolocationOptions): UseGeolocationResult {
	const [coords, setCoords] = useState<GeolocationCoords | null>(null);
	const [status, setStatus] = useState<GeolocationStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const autoRequestedRef = useRef(false);

	const request = useCallback(() => {
		if (!navigator.geolocation) {
			setStatus("unavailable");
			setError("Geolocation is not supported");
			return;
		}
		setStatus("prompting");
		setError(null);
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setCoords({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				});
				setStatus("granted");
				setError(null);
			},
			(positionError) => {
				setStatus(
					positionError.code === PERMISSION_DENIED ? "denied" : "unavailable"
				);
				setError(positionError.message);
			},
			POSITION_OPTIONS
		);
	}, []);

	useEffect(() => {
		if (!enabled) {
			autoRequestedRef.current = false;
			return;
		}
		if (autoRequestedRef.current) {
			return;
		}
		autoRequestedRef.current = true;
		request();
	}, [enabled, request]);

	return { coords, status, error, request };
}
