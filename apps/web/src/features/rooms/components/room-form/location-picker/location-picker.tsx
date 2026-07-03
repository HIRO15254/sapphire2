import {
	IconCurrentLocation,
	IconMapPin,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import type { Coords } from "./use-location-picker";
import { useLocationPicker } from "./use-location-picker";

interface LocationPickerProps {
	initialQuery?: string;
	latitude: number | null;
	longitude: number | null;
	onCoordsChange: (coords: Coords | null) => void;
}

const GPS_STATUS_MESSAGE: Partial<Record<string, string>> = {
	prompting: "Getting current location",
	denied: "Location permission denied",
	unavailable: "Location unavailable",
};

export function LocationPicker({
	initialQuery,
	latitude,
	longitude,
	onCoordsChange,
}: LocationPickerProps) {
	const {
		query,
		setQuery,
		link,
		setLink,
		handleSearch,
		results,
		isSearching,
		searchError,
		pickResult,
		handleResolveLink,
		isResolving,
		isLinkValid,
		linkError,
		captureLocation,
		gpsStatus,
		clearLocation,
		hasLocation,
	} = useLocationPicker({ initialQuery, latitude, longitude, onCoordsChange });

	const gpsMessage = GPS_STATUS_MESSAGE[gpsStatus];

	return (
		<div className="flex flex-col gap-3">
			<span className="t-label text-muted-foreground">Location</span>
			<Tabs defaultValue="search">
				<TabsList className="w-full">
					<TabsTrigger value="search">Search</TabsTrigger>
					<TabsTrigger value="link">URL</TabsTrigger>
					<TabsTrigger value="gps">Current</TabsTrigger>
				</TabsList>

				<TabsContent className="flex flex-col gap-2 pt-1" value="search">
					<div className="flex gap-2">
						<Input
							aria-label="Search a place"
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSearch();
								}
							}}
							value={query}
						/>
						<Button
							disabled={isSearching || query.trim() === ""}
							onClick={handleSearch}
							type="button"
							variant="outline"
						>
							<IconSearch size={16} />
							Search
						</Button>
					</div>
					{searchError && (
						<p className="text-destructive text-sm">{searchError}</p>
					)}
					{results.length > 0 && (
						<ul className="flex flex-col gap-1">
							{results.map((result) => (
								<li key={`${result.latitude},${result.longitude}`}>
									<button
										className="flex w-full flex-col items-start rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
										onClick={() => pickResult(result)}
										type="button"
									>
										<span className="t-body-sm font-medium">{result.name}</span>
										{result.address && (
											<span className="text-muted-foreground text-xs">
												{result.address}
											</span>
										)}
									</button>
								</li>
							))}
						</ul>
					)}
				</TabsContent>

				<TabsContent className="flex flex-col gap-2 pt-1" value="link">
					<div className="flex gap-2">
						<Input
							aria-label="Google Maps URL"
							inputMode="url"
							onChange={(e) => setLink(e.target.value)}
							value={link}
						/>
						<Button
							disabled={isResolving || !isLinkValid}
							onClick={handleResolveLink}
							type="button"
							variant="outline"
						>
							<IconMapPin size={16} />
							Set
						</Button>
					</div>
					{linkError && <p className="text-destructive text-sm">{linkError}</p>}
				</TabsContent>

				<TabsContent
					className="flex flex-wrap items-center gap-2 pt-1"
					value="gps"
				>
					<Button
						onClick={captureLocation}
						size="sm"
						type="button"
						variant="outline"
					>
						<IconCurrentLocation size={16} />
						Use current location
					</Button>
					{gpsMessage && (
						<span
							className={
								gpsStatus === "prompting"
									? "text-muted-foreground text-sm"
									: "text-destructive text-sm"
							}
						>
							{gpsMessage}
						</span>
					)}
				</TabsContent>
			</Tabs>

			{hasLocation && latitude !== null && longitude !== null && (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span className="text-muted-foreground">
						Location set: {latitude.toFixed(5)}, {longitude.toFixed(5)}
					</span>
					<a
						className="text-primary underline-offset-4 hover:underline"
						href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
						rel="noreferrer"
						target="_blank"
					>
						View on Google Maps
					</a>
					<Button
						onClick={clearLocation}
						size="xs"
						type="button"
						variant="ghost"
					>
						<IconX size={14} />
						Clear
					</Button>
				</div>
			)}
		</div>
	);
}
