import {
	StackNumberField,
	StackSecondaryGrid,
} from "@/live-sessions/components/stack-ui";
import { useTournamentFormContext } from "@/live-sessions/hooks/use-session-form";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";

interface TournamentInfoFormProps {
	chipPurchaseTypes?: Array<{ name: string; cost: number; chips: number }>;
	isLoading: boolean;
	onSubmit: (values: {
		remainingPlayers: number | null;
		totalEntries: number | null;
		chipPurchaseCounts: Array<{
			name: string;
			count: number;
			chipsPerUnit: number;
		}>;
	}) => void;
}

export function TournamentInfoForm({
	chipPurchaseTypes = [],
	isLoading,
	onSubmit,
}: TournamentInfoFormProps) {
	const { state, setRemainingPlayers, setTotalEntries, setChipPurchaseCounts } =
		useTournamentFormContext();
	const { remainingPlayers, totalEntries, chipPurchaseCounts } = state;

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit({
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			totalEntries: totalEntries ? Number(totalEntries) : null,
			chipPurchaseCounts,
		});
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<StackSecondaryGrid>
				<StackNumberField
					className="flex-1"
					id="tournament-remaining-players"
					inputMode="numeric"
					label="Remaining Players"
					min={1}
					onChange={setRemainingPlayers}
					type="number"
					value={remainingPlayers}
				/>
				<StackNumberField
					className="flex-1"
					id="tournament-total-entries"
					inputMode="numeric"
					label="Total Entries"
					min={1}
					onChange={setTotalEntries}
					type="number"
					value={totalEntries}
				/>
			</StackSecondaryGrid>

			{chipPurchaseTypes.length > 0 && (
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
									setChipPurchaseCounts((prev) => {
										const without = prev.filter((c) => c.name !== t.name);
										if (newCount === 0) {
											return without;
										}
										return [
											...without,
											{
												name: t.name,
												count: newCount,
												chipsPerUnit: t.chips,
											},
										];
									});
								}}
								type="number"
								value={countValue === 0 ? "" : String(countValue)}
							/>
						);
					})}
				</div>
			)}

			<DialogActionRow>
				<Button disabled={isLoading} type="submit">
					{isLoading ? "Saving..." : "Update"}
				</Button>
			</DialogActionRow>
		</form>
	);
}
