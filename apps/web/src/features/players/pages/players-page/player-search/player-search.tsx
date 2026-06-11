import { IconSearch } from "@tabler/icons-react";
import { Input } from "@/shared/components/ui/input";

interface PlayerSearchProps {
	onChange: (value: string) => void;
	value: string;
}

/**
 * Search box for the players list — matches against player name or tag name
 * (the filtering itself lives in `use-players-page`). Purely presentational:
 * the page hook owns the `value`/`onChange` state.
 */
export function PlayerSearch({ onChange, value }: PlayerSearchProps) {
	return (
		<div className="relative mb-4">
			<IconSearch
				className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
				size={16}
			/>
			<Input
				aria-label="Search players by name or tag"
				className="pl-9"
				onChange={(event) => onChange(event.target.value)}
				value={value}
			/>
		</div>
	);
}
