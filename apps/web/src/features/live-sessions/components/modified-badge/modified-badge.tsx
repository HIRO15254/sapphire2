import { Badge } from "@/shared/components/ui/badge";

interface ModifiedBadgeProps {
	masterValue: string;
}

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
