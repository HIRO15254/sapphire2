import { useState } from "react";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { ChipPurchaseSheet } from "@/components/live-tournament/chip-purchase-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
				<div className="flex gap-1.5 overflow-x-auto pb-1">
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
				</div>
			)}

			{/* Row 2: Stack input + optional fields */}
			<form className="flex flex-col gap-2" onSubmit={handleSubmit}>
				<div className="flex items-center gap-2">
					<Input
						className="flex-1"
						inputMode="numeric"
						min={0}
						onChange={(e) => setStackAmount(e.target.value)}
						placeholder="Stack"
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
				</div>

				<div className="flex items-center gap-2">
					<Input
						className="flex-1"
						inputMode="numeric"
						min={1}
						onChange={(e) => setRemainingPlayers(e.target.value)}
						placeholder="Remaining"
						type="number"
						value={remainingPlayers}
					/>
					<Input
						className="flex-1"
						inputMode="numeric"
						min={1}
						onChange={(e) => setTotalEntries(e.target.value)}
						placeholder="Total Entries"
						type="number"
						value={totalEntries}
					/>
				</div>

				{/* Chip purchase counts per type */}
				{chipPurchaseTypes.length > 0 && (
					<div className="flex flex-col gap-1.5">
						{chipPurchaseTypes.map((t) => {
							const countEntry = chipPurchaseCounts.find(
								(c) => c.name === t.name
							);
							const countValue = countEntry?.count ?? 0;
							return (
								<div className="flex items-center gap-2" key={t.name}>
									<Label className="w-24 shrink-0 text-xs">
										{t.name} count
									</Label>
									<Input
										className="flex-1"
										inputMode="numeric"
										min={0}
										onChange={(e) => {
											const newCount = Number(e.target.value);
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
								</div>
							);
						})}
					</div>
				)}
			</form>

			{/* Row 3: + Chip Purchase buttons */}
			<div className="flex gap-2">
				{buildChipPurchaseButtons(chipPurchaseTypes, handleInstantAdd)}
			</div>

			{/* View-only sheet for badge tap (delete only) */}
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
