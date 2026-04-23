import { StackNumberField } from "@/features/live-sessions/components/stack-ui";

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
	chipPurchaseCounts: ChipPurchaseCount[];
	chipPurchaseTypes?: ChipPurchaseType[];
	onChipPurchaseCountsChange: (v: ChipPurchaseCount[]) => void;
	onRemainingPlayersChange: (v: string) => void;
	onTotalEntriesChange: (v: string) => void;
	remainingPlayers: string;
	totalEntries: string;
}

export function TournamentInfoFields({
	chipPurchaseCounts,
	chipPurchaseTypes,
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
				value={remainingPlayers}
			/>
			<StackNumberField
				id="tournament-total-entries"
				inputMode="numeric"
				label="Total Entries"
				onChange={onTotalEntriesChange}
				value={totalEntries}
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
