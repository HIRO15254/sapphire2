import { IconScan } from "@tabler/icons-react";
import { seatLayout } from "@/features/live-sessions/utils/seat-layout";
import { cn } from "@/lib/utils";
import { SeatMarker } from "./seat-marker";

export interface TableViewPlayerSeat {
	dotColor?: string;
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

const DEFAULT_DELTA_TONE: NonNullable<TableViewProps["deltaTone"]> = "positive";

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
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
					<span className="font-mono font-semibold text-[22px] tracking-[-0.02em]">
						{stackText}
					</span>
					<div className="flex gap-2 font-mono text-xs">
						{isCash && deltaText ? (
							<span
								className={DELTA_TONE_CLASSES[deltaTone ?? DEFAULT_DELTA_TONE]}
							>
								{deltaText}
							</span>
						) : null}
						{bbText ? (
							<span className="text-muted-foreground">{bbText}</span>
						) : null}
					</div>
					{isCash && evText ? (
						<span className="text-[11px] text-muted-foreground">
							EV result <span className="font-mono">{evText}</span>
						</span>
					) : null}
					{!isCash && (remainText || averageStackText) ? (
						<span className="text-[11px] text-muted-foreground">
							Left <span className="font-mono">{remainText}</span> · Avg{" "}
							<span className="font-mono">{averageStackText}</span>
						</span>
					) : null}
				</div>
			</div>
			<button
				aria-label="Register seats from a photo"
				className="absolute top-3 left-3 z-[2] flex size-[34px] items-center justify-center rounded-full border border-border bg-card hover:bg-accent active:brightness-95"
				disabled={dimmed}
				onClick={onScan}
				title="Register seats from a photo"
				type="button"
			>
				<IconScan className="text-primary" size={18} />
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
							dotColor={seatedPlayer.dotColor}
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
