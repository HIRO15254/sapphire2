import { IconUser, IconUserPlus, IconUserStar } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type SeatMarkerVariant = "empty" | "hero" | "player";

export interface SeatMarkerProps {
	ariaLabel: string;
	disabled: boolean;
	dotColor?: string;
	leftPct: number;
	onTap?: () => void;
	topPct: number;
	variant: SeatMarkerVariant;
}

const DEFAULT_DOT_COLOR = "var(--muted-foreground)";
const EMPTY_ICON_SIZE = 13;
const HERO_ICON_SIZE = 18;
const PLAYER_ICON_SIZE = 17;

const POSITION_CLASSES =
	"absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full";

export function SeatMarker({
	ariaLabel,
	disabled,
	dotColor,
	leftPct,
	onTap,
	topPct,
	variant,
}: SeatMarkerProps) {
	const position: CSSProperties = { left: `${leftPct}%`, top: `${topPct}%` };

	if (variant === "hero") {
		return (
			<div
				aria-label={ariaLabel}
				className={cn(
					POSITION_CLASSES,
					"size-10 border border-primary bg-primary/15 text-primary"
				)}
				role="img"
				style={position}
			>
				<IconUserStar size={HERO_ICON_SIZE} />
			</div>
		);
	}

	if (variant === "empty") {
		return (
			<button
				aria-label={ariaLabel}
				className={cn(
					POSITION_CLASSES,
					"size-7 border border-border border-dashed bg-background text-muted-foreground hover:bg-muted"
				)}
				disabled={disabled}
				onClick={onTap}
				style={position}
				type="button"
			>
				<IconUserPlus size={EMPTY_ICON_SIZE} />
			</button>
		);
	}

	const dotStyle: CSSProperties & Record<"--seat-dot-color", string> = {
		...position,
		"--seat-dot-color": dotColor ?? DEFAULT_DOT_COLOR,
	};

	return (
		<button
			aria-label={ariaLabel}
			className={cn(
				POSITION_CLASSES,
				"size-10 border border-[var(--seat-dot-color)] bg-[color-mix(in_oklab,var(--seat-dot-color)_14%,var(--background))] text-foreground shadow-(--shadow-soft-sm) hover:bg-muted"
			)}
			disabled={disabled}
			onClick={onTap}
			style={dotStyle}
			type="button"
		>
			<IconUser size={PLAYER_ICON_SIZE} />
		</button>
	);
}
