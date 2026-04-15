import { StackNumberField } from "@/live-sessions/components/stack-ui";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

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
			<Field
				htmlFor="tournament-remaining-players"
				label="Remaining Players"
			>
				<Input
					id="tournament-remaining-players"
					inputMode="numeric"
					min={1}
					onChange={(e) => onRemainingPlayersChange(e.target.value)}
					placeholder="Optional"
					type="number"
					value={remainingPlayers}
				/>
			</Field>
			<Field htmlFor="tournament-total-entries" label="Total Entries">
				<Input
					id="tournament-total-entries"
					inputMode="numeric"
					min={1}
					onChange={(e) => onTotalEntriesChange(e.target.value)}
					placeholder="Optional"
					type="number"
					value={totalEntries}
				/>
			</Field>
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
								min={0}
								onChange={(value) => {
									const newCount = Number(value);
									const without = chipPurchaseCounts.filter(
										(c) => c.name !== t.name
									);
									if (newCount === 0) {
										onChipPurchaseCountsChange(without);
									} else {
										onChipPurchaseCountsChange([
											...without,
											{
												name: t.name,
												count: newCount,
												chipsPerUnit: t.chips,
											},
										]);
									}
								}}
								type="number"
								value={countValue === 0 ? "" : String(countValue)}
							/>
						);
					})}
				</div>
			)}
		</>
	);
}
