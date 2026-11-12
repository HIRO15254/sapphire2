import { cn } from "@/lib/utils";
import { ICON_FONT_FAMILY } from "@/shared/lib/tabler-icons/icon-data";
import { useTablerIcon } from "./use-tabler-icon";

interface TablerIconProps {
	className?: string;
	fallback?: string;
	name: string;
	size?: number;
}

export function TablerIcon({
	className,
	fallback,
	name,
	size = 16,
}: TablerIconProps) {
	const { glyph, isFallback } = useTablerIcon(name, fallback);
	return (
		<span
			aria-hidden
			className={cn(
				"inline-flex shrink-0 items-center justify-center leading-none antialiased select-none",
				isFallback && "text-muted-foreground",
				className
			)}
			data-slot="tabler-icon"
			style={{
				fontFamily: ICON_FONT_FAMILY,
				fontSize: size,
				height: size,
				visibility: glyph?.ready ? undefined : "hidden",
				width: size,
			}}
		>
			{glyph?.char}
		</span>
	);
}
