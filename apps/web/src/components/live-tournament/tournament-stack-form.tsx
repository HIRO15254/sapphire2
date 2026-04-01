import { useState } from "react";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { ChipPurchaseSheet } from "@/components/live-tournament/chip-purchase-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournamentFormContext } from "@/routes/active-session";

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

interface SheetState {
	defaultChips?: number;
	defaultCost?: number;
	defaultName?: string;
	editId?: number;
	open: boolean;
}

function buildChipPurchaseButtons(
	chipPurchaseTypes: ChipPurchaseType[],
	onOpen: (state: Omit<SheetState, "open">) => void
) {
	if (chipPurchaseTypes.length === 0) {
		return (
			<Button
				onClick={() => onOpen({})}
				size="xs"
				type="button"
				variant="ghost"
			>
				+ Chip Purchase
			</Button>
		);
	}
	return chipPurchaseTypes.map((t) => (
		<Button
			key={t.name}
			onClick={() =>
				onOpen({
					defaultName: t.name,
					defaultCost: t.cost,
					defaultChips: t.chips,
				})
			}
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

	const [sheetState, setSheetState] = useState<SheetState>({ open: false });

	const openSheet = (overrides: Omit<SheetState, "open">) => {
		setSheetState({ open: true, ...overrides });
	};

	const closeSheet = () => {
		setSheetState({ open: false });
	};

	const handleSheetSubmit = (purchase: {
		name: string;
		cost: number;
		chips: number;
	}) => {
		if (sheetState.editId !== undefined) {
			removeChipPurchase(sheetState.editId);
		}
		addChipPurchase(purchase);
		closeSheet();
	};

	const handleSheetDelete = () => {
		if (sheetState.editId !== undefined) {
			removeChipPurchase(sheetState.editId);
		}
		closeSheet();
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

	const editingPurchase =
		sheetState.editId !== undefined
			? chipPurchases.find((p) => p.id === sheetState.editId)
			: undefined;

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
							onEdit={() =>
								openSheet({
									editId: purchase.id,
									defaultName: purchase.name,
									defaultCost: purchase.cost,
									defaultChips: purchase.chips,
								})
							}
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
				{buildChipPurchaseButtons(chipPurchaseTypes, openSheet)}
			</div>

			{/* Bottom sheet */}
			<ChipPurchaseSheet
				defaultChips={sheetState.defaultChips}
				defaultCost={sheetState.defaultCost}
				defaultName={sheetState.defaultName}
				initialValues={
					editingPurchase
						? {
								name: editingPurchase.name,
								cost: editingPurchase.cost,
								chips: editingPurchase.chips,
							}
						: undefined
				}
				onDelete={
					sheetState.editId !== undefined ? handleSheetDelete : undefined
				}
				onOpenChange={(open) => {
					if (!open) {
						closeSheet();
					}
				}}
				onSubmit={handleSheetSubmit}
				open={sheetState.open}
			/>
		</div>
	);
}
