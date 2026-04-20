import { StackNumberField } from "@/live-sessions/components/stack-ui";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

interface TournamentInfoFieldsProps {
	averageStack: string;
	chipPurchaseCounts: ChipPurchaseCount[];
	chipPurchaseTypes?: ChipPurchaseType[];
	onAverageStackChange: (v: string) => void;
	onChipPurchaseCountsChange: (v: ChipPurchaseCount[]) => void;
	onRemainingPlayersChange: (v: string) => void;
	onTotalEntriesChange: (v: string) => void;
	remainingPlayers: string;
	totalEntries: string;
}

export function TournamentInfoFields({
	averageStack,
	chipPurchaseCounts,
	chipPurchaseTypes,
	onAverageStackChange,
	onChipPurchaseCountsChange,
	onRemainingPlayersChange,
	onTotalEntriesChange,
	remainingPlayers,
	totalEntries,
}: TournamentInfoFieldsProps) {
	return (
		<>
			<StackNumberField
				id="tournament-remaining-players"
				inputMode="numeric"
				label="Remaining Players"
				onChange={onRemainingPlayersChange}
				placeholder="Optional"
				value={remainingPlayers}
			/>
			<StackNumberField
				id="tournament-total-entries"
				inputMode="numeric"
				label="Total Entries"
				onChange={onTotalEntriesChange}
				placeholder="Optional"
				value={totalEntries}
			/>
			<StackNumberField
				id="tournament-average-stack"
				inputMode="numeric"
				label="Avg Stack"
				onChange={onAverageStackChange}
				placeholder="Optional"
				value={averageStack}
			/>
			{chipPurchaseTypes && chipPurchaseTypes.length > 0 && (
				<div className="flex flex-col gap-1.5">
					{chipPurchaseTypes.map((t) => {
						const countEntry = chipPurchaseCounts.find(
							(c) => c.name === t.name
						);
						const countValue = countEntry?.count ?? 0;
						return (
							<StackNumberField
								className="flex-1"
								id={`chip-purchase-count-${t.name}`}
								inputMode="numeric"
								key={t.name}
								label={`${t.name} count`}
								onChange={(value) => {
									const newCount = Number(value);
									const without = chipPurchaseCounts.filter(
										(c) => c.name !== t.name
									);
									if (newCount) {
										onChipPurchaseCountsChange([
											...without,
											{
												name: t.name,
												count: newCount,
												chipsPerUnit: t.chips,
											},
										]);
									} else {
										onChipPurchaseCountsChange(without);
									}
								}}
								value={countValue === 0 ? "" : String(countValue)}
							/>
						);
					})}
				</div>
			)}
		</>
	);
}
