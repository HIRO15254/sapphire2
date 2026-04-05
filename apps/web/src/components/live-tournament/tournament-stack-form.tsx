import { useState } from "react";
import { EventBadge } from "@/components/live-sessions/event-badge";
import {
	StackBadgeRow,
	StackNumberField,
	StackPrimaryRow,
	StackQuickActions,
	StackSecondaryGrid,
} from "@/components/live-sessions/stack-ui";
import { ChipPurchaseSheet } from "@/components/live-tournament/chip-purchase-sheet";
import { Button } from "@/components/ui/button";
import { useTournamentFormContext } from "@/hooks/use-session-form";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

interface TournamentStackFormProps {
	chipPurchaseTypes?: ChipPurchaseType[];
	isLoading: boolean;
	onComplete: () => void;
	onSubmit: (values: {
		chipPurchaseCounts: Array<{
			name: string;
			count: number;
			chipsPerUnit: number;
		}>;
		chipPurchases: Array<{ name: string; cost: number; chips: number }>;
		remainingPlayers: number | null;
		stackAmount: number;
		totalEntries: number | null;
	}) => void;
}

function buildChipPurchaseButtons(
	chipPurchaseTypes: ChipPurchaseType[],
	onAdd: (type: ChipPurchaseType) => void
) {
	if (chipPurchaseTypes.length === 0) {
		return null;
	}
	return chipPurchaseTypes.map((t) => (
		<Button
			key={t.name}
			onClick={() => onAdd(t)}
			size="xs"
			type="button"
			variant="ghost"
		>
			+ {t.name}
		</Button>
	));
}

export function TournamentStackForm({
	chipPurchaseTypes = [],
	isLoading,
	onComplete,
	onSubmit,
}: TournamentStackFormProps) {
	const {
		state,
		setStackAmount,
		setRemainingPlayers,
		setTotalEntries,
		setChipPurchaseCounts,
		addChipPurchase,
		removeChipPurchase,
	} = useTournamentFormContext();

	const {
		stackAmount,
		remainingPlayers,
		totalEntries,
		chipPurchases,
		chipPurchaseCounts,
	} = state;

	// View-only sheet for badge tap (delete only, no edit)
	const [viewingPurchase, setViewingPurchase] = useState<{
		id: number;
		name: string;
		cost: number;
		chips: number;
	} | null>(null);

	const handleInstantAdd = (type: ChipPurchaseType) => {
		addChipPurchase({ name: type.name, cost: type.cost, chips: type.chips });
		// Auto-increment stack by chips received
		const currentStack = Number(stackAmount) || 0;
		setStackAmount(String(currentStack + type.chips));
	};

	const handleDeleteViewing = () => {
		if (viewingPurchase) {
			// Decrement stack by chips removed
			const currentStack = Number(stackAmount) || 0;
			setStackAmount(String(Math.max(0, currentStack - viewingPurchase.chips)));
			removeChipPurchase(viewingPurchase.id);
			setViewingPurchase(null);
		}
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		onSubmit({
			stackAmount: Number(stackAmount),
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			totalEntries: totalEntries ? Number(totalEntries) : null,
			chipPurchases: chipPurchases.map(({ name, cost, chips }) => ({
				name,
				cost,
				chips,
			})),
			chipPurchaseCounts,
		});

		// Reset chip purchases after submit, but keep stack fields
		for (const p of chipPurchases) {
			removeChipPurchase(p.id);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			{/* Row 1: Event badges */}
			{chipPurchases.length > 0 && (
				<StackBadgeRow>
					{chipPurchases.map((purchase) => (
						<EventBadge
							data={{
								name: purchase.name,
								cost: purchase.cost,
								chips: purchase.chips,
							}}
							key={purchase.id}
							onEdit={() => setViewingPurchase(purchase)}
							type="chip-purchase"
						/>
					))}
				</StackBadgeRow>
			)}

			<form className="flex flex-col gap-2" onSubmit={handleSubmit}>
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
			</form>

			<StackQuickActions>
				{buildChipPurchaseButtons(chipPurchaseTypes, handleInstantAdd)}
			</StackQuickActions>

			<ChipPurchaseSheet
				initialValues={
					viewingPurchase
						? {
								name: viewingPurchase.name,
								cost: viewingPurchase.cost,
								chips: viewingPurchase.chips,
							}
						: undefined
				}
				onDelete={viewingPurchase ? handleDeleteViewing : undefined}
				onOpenChange={(open) => {
					if (!open) {
						setViewingPurchase(null);
					}
				}}
				onSubmit={() => setViewingPurchase(null)}
				open={viewingPurchase !== null}
				readOnly
			/>
		</div>
	);
}
