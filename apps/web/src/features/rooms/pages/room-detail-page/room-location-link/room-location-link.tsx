import { IconMapPin } from "@tabler/icons-react";

interface RoomLocationLinkProps {
	latitude: number | null | undefined;
	longitude: number | null | undefined;
}

/**
 * "View on Google Maps" link shown on the room detail page when the room has
 * coordinates. Uses the key-free Maps search URL so no API key is needed.
 */
export function RoomLocationLink({
	latitude,
	longitude,
}: RoomLocationLinkProps) {
	if (
		latitude === null ||
		latitude === undefined ||
		longitude === null ||
		longitude === undefined
	) {
		return null;
	}

	return (
		<div className="mt-1 mb-3">
			<a
				className="inline-flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
				href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
				rel="noreferrer"
				target="_blank"
			>
				<IconMapPin size={16} />
				View on Google Maps
			</a>
		</div>
	);
}
