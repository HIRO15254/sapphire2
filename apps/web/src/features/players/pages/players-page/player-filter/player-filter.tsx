import { cn } from "@/lib/utils";

interface PlayerFilterProps {
	availableTags: Array<{ color: string; id: string; name: string }>;
	onToggle: (tagId: string) => void;
	selectedTagIds: string[];
}

/**
 * Tag filter for the players list — a horizontal row of toggle chips. Purely
 * presentational: the page hook owns `selectedTagIds` and `onToggle`. Renders
 * nothing when there are no tags to filter by, so the list isn't pushed down by
 * an empty control.
 */
export function PlayerFilter({
	availableTags,
	onToggle,
	selectedTagIds,
}: PlayerFilterProps) {
	if (availableTags.length === 0) {
		return null;
	}

	return (
		<fieldset className="mb-4 flex flex-wrap gap-2 border-0 p-0">
			<legend className="sr-only">Filter players by tag</legend>
			{availableTags.map((tag) => {
				const active = selectedTagIds.includes(tag.id);
				return (
					<button
						aria-pressed={active}
						className={cn(
							"rounded-full border px-3 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
							active
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-card text-muted-foreground hover:bg-muted/50"
						)}
						key={tag.id}
						onClick={() => onToggle(tag.id)}
						type="button"
					>
						{tag.name}
					</button>
				);
			})}
		</fieldset>
	);
}
