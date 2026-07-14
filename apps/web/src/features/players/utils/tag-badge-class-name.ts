import {
	TAG_COLORS,
	type TagColor,
} from "@/features/players/constants/player-tag-colors";
import { cn } from "@/lib/utils";

export function tagBadgeClassName(color: string, className?: string) {
	const colorConfig = TAG_COLORS[color as TagColor] ?? TAG_COLORS.gray;

	return cn(colorConfig.bg, colorConfig.text, className);
}
