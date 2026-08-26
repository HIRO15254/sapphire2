import { IconUser, IconUserPlus, IconUserStar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SeatMarkerVariant = "empty" | "hero" | "player";

export interface SeatMarkerProps {
	ariaLabel: string;
	disabled: boolean;
	leftPct: number;
	onTap?: () => void;
	topPct: number;
	variant: SeatMarkerVariant;
}

const VARIANT_CLASSES: Record<SeatMarkerVariant, string> = {
	empty: "size-7 rounded-full border border-border border-dashed bg-background",
	hero: "size-10 rounded-full border border-primary bg-primary/15",
	player:
		"size-10 rounded-full border border-border bg-card shadow-(--shadow-soft-sm)",
};

function SeatMarkerIcon({ variant }: { variant: SeatMarkerVariant }) {
	if (variant === "empty") {
		return <IconUserPlus className="size-[13px] text-muted-foreground" />;
	}
	if (variant === "hero") {
		return <IconUserStar className="size-[17px] text-primary" />;
	}
	return <IconUser className="size-[17px] text-foreground" />;
}

export function SeatMarker({
	ariaLabel,
	disabled,
	leftPct,
	onTap,
	topPct,
	variant,
}: SeatMarkerProps) {
	const position = { left: `${leftPct}%`, top: `${topPct}%` };

	if (variant === "hero") {
		return (
			<div
				aria-label={ariaLabel}
				className={cn(
					"absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center",
					VARIANT_CLASSES.hero
				)}
				role="img"
				style={position}
			>
				<SeatMarkerIcon variant={variant} />
			</div>
		);
	}

	return (
		<button
			aria-label={ariaLabel}
			className={cn(
				"absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center",
				VARIANT_CLASSES[variant]
			)}
			disabled={disabled}
			onClick={onTap}
			style={position}
			type="button"
		>
			<SeatMarkerIcon variant={variant} />
		</button>
	);
}
