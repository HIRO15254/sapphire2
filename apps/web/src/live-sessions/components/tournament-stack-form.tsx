import { useState } from "react";
import { ChipPurchaseSheet } from "@/live-sessions/components/chip-purchase-sheet";
import {
	StackNumberField,
	StackPrimaryRow,
	StackQuickActions,
	StackSecondaryGrid,
} from "@/live-sessions/components/stack-ui";
import { useTournamentFormContext } from "@/live-sessions/hooks/use-session-form";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

interface TournamentStackFormSubmitValues {
	chipPurchaseCounts: Array<{ chipsPerUnit: number; count: number; name: string }>;
	recordTournamentInfo: boolean;
	remainingPlayers: number | null;
	stackAmount: number;
	totalEntries: number | null;
}

interface TournamentStackFormProps {
	chipPurchaseTypes?: ChipPurchaseType[];
	isLoading: boolean;
	onComplete: () => void;
	onMemo: (text: string) => void;
	onPause: () => void;
	onPurchaseChips: (values: {
		chips: number;
		cost: number;
		name: string;
	}) => void;
	onSubmit: (values: TournamentStackFormSubmitValues) => void;
}

export function TournamentStackForm({
	chipPurchaseTypes = [],
	isLoading,
	onComplete,
	onMemo,
	onPause,
	onPurchaseChips,
	onSubmit,
}: TournamentStackFormProps) {
	const { state, setStackAmount, setRemainingPlayers, setTotalEntries, setChipPurchaseCounts } =
		useTournamentFormContext();
	const { stackAmount, remainingPlayers, totalEntries, chipPurchaseCounts } = state;

	const [recordTournamentInfo, setRecordTournamentInfo] = useState(true);
	const [chipPurchaseSheetOpen, setChipPurchaseSheetOpen] = useState(false);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit({
			stackAmount: Number(stackAmount),
			recordTournamentInfo,
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			totalEntries: totalEntries ? Number(totalEntries) : null,
			chipPurchaseCounts,
		});
	};

	const handleChipPurchaseSubmit = (values: {
		chips: number;
		cost: number;
		name: string;
	}) => {
		onPurchaseChips(values);
		setChipPurchaseSheetOpen(false);
	};

	return (
		<div className="flex flex-col gap-4">
			<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
				<StackPrimaryRow>
					<StackNumberField
						className="sm:min-w-[12rem]"
						id="tournament-stack-amount"
						inputMode="numeric"
						label="Current Stack"
						min={0}
						onChange={setStackAmount}
						required
						type="number"
						value={stackAmount}
					/>
					<Button disabled={isLoading} size="sm" type="submit">
						{isLoading ? "..." : "Update"}
					</Button>
					<Button
						onClick={onComplete}
						size="sm"
						type="button"
						variant="outline"
					>
						End
					</Button>
				</StackPrimaryRow>

				<div className="flex items-center gap-2">
					<Checkbox
						checked={recordTournamentInfo}
						id="record-tournament-info"
						onCheckedChange={(checked) =>
							setRecordTournamentInfo(checked === true)
						}
					/>
					<Label htmlFor="record-tournament-info">トーナメント状況も記録する</Label>
				</div>

				{recordTournamentInfo && (
					<div className="flex flex-col gap-3">
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
					</div>
				)}
			</form>

			<StackQuickActions>
				<Button
					onClick={() => setChipPurchaseSheetOpen(true)}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Chip Purchase
				</Button>
				<Button
					onClick={() => onMemo("")}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Memo
				</Button>
				<Button onClick={onPause} size="xs" type="button" variant="ghost">
					Pause
				</Button>
			</StackQuickActions>

			<ChipPurchaseSheet
				onOpenChange={setChipPurchaseSheetOpen}
				onSubmit={handleChipPurchaseSubmit}
				open={chipPurchaseSheetOpen}
				shortcuts={chipPurchaseTypes}
			/>
		</div>
	);
}
