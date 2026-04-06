import { TAG_COLORS, type TagColor } from "@/players/constants/player-tag-colors";
import { cn } from "@/lib/utils";

interface ColorBadgeProps {
	children: React.ReactNode;
	className?: string;
	color: string;
}

export function ColorBadge({ color, children, className }: ColorBadgeProps) {
	const colorConfig = TAG_COLORS[color as TagColor] ?? TAG_COLORS.gray;

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs",
				colorConfig.bg,
				colorConfig.text,
				className
			)}
		>
			{children}
		</span>
	);
}
