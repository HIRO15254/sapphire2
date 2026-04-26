import {
	TAG_COLORS,
	type TagColor,
} from "@/features/players/constants/player-tag-colors";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";

interface ColorBadgeProps {
	children: React.ReactNode;
	className?: string;
	color: string;
}

export function ColorBadge({ color, children, className }: ColorBadgeProps) {
	const colorConfig = TAG_COLORS[color as TagColor] ?? TAG_COLORS.gray;

	return (
		<Badge className={cn(colorConfig.bg, colorConfig.text, className)}>
			{children}
		</Badge>
	);
}
