import { IconScan } from "@tabler/icons-react";
import { seatLayout } from "@/features/live-sessions/utils/seat-layout";
import { cn } from "@/lib/utils";
import { SeatMarker } from "./seat-marker";

export interface TableViewPlayerSeat {
	playerId: string;
	playerName: string;
	seatPosition: number;
}

export interface TableViewProps {
	averageStackText?: string;
	bbText?: string;
	deltaText?: string;
	deltaTone?: "positive" | "negative" | "neutral";
	dimmed: boolean;
	evText?: string;
	heroSeatPosition: number | null;
	kind: "cash_game" | "tournament";
	onEmptySeatTap: (seatPosition: number) => void;
	onPlayerSeatTap: (seat: TableViewPlayerSeat) => void;
	onScan: () => void;
	remainText?: string;
	seatCount: number;
	seatedPlayers: TableViewPlayerSeat[];
	stackText: string;
}

const DELTA_TONE_CLASSES: Record<
	NonNullable<TableViewProps["deltaTone"]>,
	string
> = {
	negative: "text-destructive",
	neutral: "text-foreground",
	positive: "text-success",
};

export function TableView({
	averageStackText,
	bbText,
	deltaText,
	deltaTone,
	dimmed,
	evText,
	heroSeatPosition,
	kind,
	onEmptySeatTap,
	onPlayerSeatTap,
	onScan,
	remainText,
	seatCount,
	seatedPlayers,
	stackText,
}: TableViewProps) {
	const points = seatLayout(seatCount);
	const seatedByPosition = new Map(
		seatedPlayers.map((seat) => [seat.seatPosition, seat])
	);
	const isCash = kind === "cash_game";

	return (
		<div className={cn("relative h-[240px]", dimmed && "opacity-50")}>
			<div className="absolute inset-[34px_46px] rounded-[48px] border border-border bg-card">
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
					<span className="font-mono font-semibold text-[22px] tracking-tight">
						{stackText}
					</span>
					{isCash && (deltaText || bbText) ? (
						<span className="flex items-center gap-1.5">
							{deltaText ? (
								<span
									className={cn(
										"font-mono text-xs",
										DELTA_TONE_CLASSES[deltaTone ?? "neutral"]
									)}
								>
									{deltaText}
								</span>
							) : null}
							{bbText ? (
								<span className="font-mono text-muted-foreground text-xs">
									{bbText}
								</span>
							) : null}
						</span>
					) : null}
					{isCash && evText ? (
						<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
							<span>EV result</span>
							<span className="font-mono">{evText}</span>
						</span>
					) : null}
					{!isCash && (remainText || averageStackText) ? (
						<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
							<span>Left</span>
							<span className="font-mono">{remainText}</span>
							<span>·</span>
							<span>Avg</span>
							<span className="font-mono">{averageStackText}</span>
						</span>
					) : null}
				</div>
			</div>
			<button
				aria-label="Scan seats"
				className="absolute top-3 left-3 flex size-[34px] items-center justify-center rounded-full border border-border bg-card"
				disabled={dimmed}
				onClick={onScan}
				type="button"
			>
				<IconScan className="text-primary" />
			</button>
			{points.map((point, index) => {
				const seatPosition = index;
				const seatLabel = seatPosition + 1;

				if (heroSeatPosition === seatPosition) {
					return (
						<SeatMarker
							ariaLabel={`Seat ${seatLabel} — you`}
							disabled={dimmed}
							key={seatPosition}
							leftPct={point.leftPct}
							topPct={point.topPct}
							variant="hero"
						/>
					);
				}

				const seatedPlayer = seatedByPosition.get(seatPosition);
				if (seatedPlayer) {
					return (
						<SeatMarker
							ariaLabel={`Seat ${seatLabel} — ${seatedPlayer.playerName}`}
							disabled={dimmed}
							key={seatPosition}
							leftPct={point.leftPct}
							onTap={() => onPlayerSeatTap(seatedPlayer)}
							topPct={point.topPct}
							variant="player"
						/>
					);
				}

				return (
					<SeatMarker
						ariaLabel={`Seat ${seatLabel} — empty`}
						disabled={dimmed}
						key={seatPosition}
						leftPct={point.leftPct}
						onTap={() => onEmptySeatTap(seatPosition)}
						topPct={point.topPct}
						variant="empty"
					/>
				);
			})}
		</div>
	);
}
