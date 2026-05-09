import type { BlindLevel, BlindSet } from "../blind-set-editor";
import { BlindSetEditor } from "../blind-set-editor";
import type { ChipPurchaseOption } from "../chip-purchase-option-editor";
import { ChipPurchaseOptionEditor } from "../chip-purchase-option-editor";
import { useGameRuleSection } from "./use-game-rule-section";

interface GameRuleSectionProps {
	blindLevels?: BlindLevel[];
	cashBlindSets?: BlindSet[];
	cashDetail?: {
		ruleName?: string | null;
		minBuyIn?: number | null;
		maxBuyIn?: number | null;
		tableSize?: number | null;
		variantId?: number | null;
		ringGameId?: string | null;
	} | null;
	chipPurchaseOptions?: ChipPurchaseOption[];
	isLive: boolean;
	isReadOnly: boolean;
	kind: "cash_game" | "tournament";
	sessionId: string;
	tournamentDetail?: {
		ruleName?: string | null;
		startingStack?: number | null;
		bountyAmount?: number | null;
		tableSize?: number | null;
		variantId?: number | null;
		buyIn?: number | null;
		entryFee?: number | null;
		tournamentId?: string | null;
		timerStartedAt?: Date | null;
	} | null;
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value?: string | number | null;
}) {
	if (value == null) {
		return null;
	}
	return (
		<div className="flex justify-between py-1 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span>{value}</span>
		</div>
	);
}

export function GameRuleSection({
	blindLevels,
	cashBlindSets,
	chipPurchaseOptions,
	isLive,
	isReadOnly,
	kind,
	sessionId,
	cashDetail,
	tournamentDetail,
}: GameRuleSectionProps) {
	const { isUpdatePending } = useGameRuleSection({
		sessionId,
		kind,
		cashDetail,
		tournamentDetail,
		isLive,
		isReadOnly,
	});

	return (
		<div className="flex flex-col gap-4">
			{kind === "cash_game" ? (
				<div className="flex flex-col divide-y">
					<DetailRow label="Rule name" value={cashDetail?.ruleName} />
					<DetailRow label="Min buy-in" value={cashDetail?.minBuyIn} />
					<DetailRow label="Max buy-in" value={cashDetail?.maxBuyIn} />
					<DetailRow label="Table size" value={cashDetail?.tableSize} />
				</div>
			) : (
				<div className="flex flex-col divide-y">
					<DetailRow label="Rule name" value={tournamentDetail?.ruleName} />
					<DetailRow label="Buy-in" value={tournamentDetail?.buyIn} />
					<DetailRow label="Entry fee" value={tournamentDetail?.entryFee} />
					<DetailRow
						label="Starting stack"
						value={tournamentDetail?.startingStack}
					/>
					<DetailRow
						label="Bounty amount"
						value={tournamentDetail?.bountyAmount}
					/>
					<DetailRow label="Table size" value={tournamentDetail?.tableSize} />
				</div>
			)}

			<div className="flex flex-col gap-1">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					{kind === "cash_game" ? "Blind Sets" : "Blind Levels"}
				</p>
				<BlindSetEditor
					blindLevels={blindLevels}
					cashBlindSets={cashBlindSets}
					isReadOnly={isReadOnly || !isLive}
					kind={kind}
					sessionId={sessionId}
				/>
			</div>

			{kind === "tournament" && (
				<div className="flex flex-col gap-1">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Chip Purchase Options
					</p>
					<ChipPurchaseOptionEditor
						isReadOnly={isReadOnly || !isLive}
						options={chipPurchaseOptions ?? []}
						sessionId={sessionId}
					/>
				</div>
			)}

			{isUpdatePending && (
				<p className="text-muted-foreground text-xs">Saving...</p>
			)}
		</div>
	);
}
