import { Badge } from "@/shared/components/ui/badge";

interface ModifiedBadgeProps {
	/** Human-readable master value surfaced on hover via the native title. */
	masterValue: string;
}

/**
 * Small badge surfaced next to a snapshot field that has drifted from the
 * parent ring_game / tournament. Hover reveals the master value so the user
 * can decide whether to revert.
 */
export function ModifiedBadge({ masterValue }: ModifiedBadgeProps) {
	return (
		<Badge
			className="px-1 py-0 text-[10px]"
			title={`Master: ${masterValue}`}
			variant="outline"
		>
			Modified
		</Badge>
	);
}
