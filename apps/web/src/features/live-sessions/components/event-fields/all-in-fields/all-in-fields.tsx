import {
	type AllInPreview,
	computeAllInPreview,
} from "@/features/live-sessions/utils/all-in-preview";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { formatNumber } from "@/utils/format-number";

interface AllInFieldsProps {
	equity: string;
	equityError?: string;
	onEquityChange: (v: string) => void;
	onPotSizeChange: (v: string) => void;
	onTrialsChange: (v: string) => void;
	onWinsChange: (v: string) => void;
	potSize: string;
	potSizeError?: string;
	trials: string;
	trialsError?: string;
	wins: string;
	winsError?: string;
}

interface AllInPreviewBoxProps {
	equity: string;
	potSize: string;
	preview: AllInPreview;
	trials: string;
	wins: string;
}

function AllInPreviewBox({
	equity,
	potSize,
	preview,
	trials,
	wins,
}: AllInPreviewBoxProps) {
	const potSizeNum = Number(potSize);
	const winsLabel = wins === "1" ? "win" : "wins";
	return (
		<div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5 text-xs">
			<div className="flex items-center justify-between">
				<span className="text-muted-foreground">
					Expected ({formatNumber(potSizeNum)} × {equity}%)
				</span>
				<span className="font-mono">
					+{formatNumber(preview.expectedValue)}
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-muted-foreground">
					Realized ({formatNumber(potSizeNum)} ÷ {trials} × {wins} {winsLabel})
				</span>
				<span className="font-mono">
					-{formatNumber(preview.realizedValue)}
				</span>
			</div>
			<div className="flex items-center justify-between border-border border-t pt-1">
				<span className="font-semibold">EV delta</span>
				<span
					className={cn(
						"font-mono",
						preview.evDelta >= 0 ? "text-success" : "text-destructive"
					)}
				>
					{preview.evDelta >= 0 ? "+" : ""}
					{formatNumber(preview.evDelta)}
				</span>
			</div>
		</div>
	);
}

export function AllInFields({
	equity,
	equityError,
	onEquityChange,
	onPotSizeChange,
	onTrialsChange,
	onWinsChange,
	potSize,
	potSizeError,
	trials,
	trialsError,
	wins,
	winsError,
}: AllInFieldsProps) {
	const preview = computeAllInPreview({
		equity: Number(equity),
		potSize: Number(potSize),
		trials: Number(trials),
		wins: Number(wins),
	});

	return (
		<>
			<Field error={potSizeError} htmlFor="allIn-potSize" label="Pot" required>
				<Input
					id="allIn-potSize"
					inputMode="decimal"
					onChange={(e) => onPotSizeChange(e.target.value)}
					value={potSize}
				/>
			</Field>
			<Field error={trialsError} htmlFor="allIn-trials" label="Runs" required>
				<Input
					id="allIn-trials"
					inputMode="numeric"
					onChange={(e) => onTrialsChange(e.target.value)}
					value={trials}
				/>
			</Field>
			<Field error={equityError} htmlFor="allIn-equity" label="Equity %">
				<Input
					id="allIn-equity"
					inputMode="decimal"
					onChange={(e) => onEquityChange(e.target.value)}
					value={equity}
				/>
			</Field>
			<Field
				description="Decimal values are allowed for chopped pots."
				error={winsError}
				htmlFor="allIn-wins"
				label="Wins"
			>
				<Input
					id="allIn-wins"
					inputMode="decimal"
					onChange={(e) => onWinsChange(e.target.value)}
					value={wins}
				/>
			</Field>
			{preview ? (
				<AllInPreviewBox
					equity={equity}
					potSize={potSize}
					preview={preview}
					trials={trials}
					wins={wins}
				/>
			) : null}
		</>
	);
}
