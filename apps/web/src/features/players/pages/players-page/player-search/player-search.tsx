import { IconSearch } from "@tabler/icons-react";
import { Input } from "@/shared/components/ui/input";

interface PlayerSearchProps {
	onChange: (value: string) => void;
	value: string;
}

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
