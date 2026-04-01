import { useState } from "react";
import { ChipPurchaseSheet } from "@/components/live-tournament/chip-purchase-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TournamentStackRecordPayload {
	chipPurchaseCounts: Array<{
		name: string;
		count: number;
		chipsPerUnit: number;
	}>;
	chipPurchases: Array<{ name: string; cost: number; chips: number }>;
	remainingPlayers: number | null;
	stackAmount: number;
	totalEntries: number | null;
}

interface TournamentStackRecordEditorProps {
	initialOccurredAt?: string | Date;
	initialPayload: TournamentStackRecordPayload;
	isLoading: boolean;
	maxTime?: Date | null;
	minTime?: Date | null;
	onDelete: () => void;
	onSubmit: (
		payload: TournamentStackRecordPayload,
		occurredAt?: number
	) => void;
}

function toTimeInputValue(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function applyTimeToDate(original: string | Date, timeStr: string): Date {
	const date = new Date(typeof original === "string" ? original : original);
	const [h, m] = timeStr.split(":").map(Number);
	date.setHours(h ?? 0, m ?? 0);
	return date;
}

function validateTime(
	timeStr: string,
	original: string | Date,
	minTime: Date | null | undefined,
	maxTime: Date | null | undefined
): string | null {
	const newDate = applyTimeToDate(original, timeStr);
	if (minTime && newDate.getTime() < minTime.getTime()) {
		const fmt = `${String(minTime.getHours()).padStart(2, "0")}:${String(minTime.getMinutes()).padStart(2, "0")}`;
		return `Must be after ${fmt}`;
	}
	if (maxTime && newDate.getTime() > maxTime.getTime()) {
		const fmt = `${String(maxTime.getHours()).padStart(2, "0")}:${String(maxTime.getMinutes()).padStart(2, "0")}`;
		return `Must be before ${fmt}`;
	}
	return null;
}

interface EditingPurchase {
	chips: number;
	cost: number;
	index: number;
	name: string;
}

function ChipPurchaseList({
	purchases,
	onEdit,
	onAdd,
	onRemove,
}: {
	purchases: Array<{ name: string; cost: number; chips: number }>;
	onAdd: () => void;
	onEdit: (index: number) => void;
	onRemove: (index: number) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<Label>Chip Purchases</Label>
				<Button onClick={onAdd} size="xs" type="button" variant="ghost">
					+ Add
				</Button>
			</div>
			{purchases.map((purchase, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: order-stable list
				<div className="flex items-center justify-between" key={i}>
					<span className="text-muted-foreground text-xs">
						{purchase.name}: cost {purchase.cost}, chips {purchase.chips}
					</span>
					<div className="flex items-center gap-1">
						<Button
							onClick={() => onEdit(i)}
							size="xs"
							type="button"
							variant="ghost"
						>
							Edit
						</Button>
						<Button
							onClick={() => onRemove(i)}
							size="xs"
							type="button"
							variant="ghost"
						>
							Remove
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}

export function TournamentStackRecordEditor({
	initialOccurredAt,
	initialPayload,
	isLoading,
	maxTime,
	minTime,
	onDelete,
	onSubmit,
}: TournamentStackRecordEditorProps) {
	const [stackAmount, setStackAmount] = useState(
		String(initialPayload.stackAmount)
	);
	const [remainingPlayers, setRemainingPlayers] = useState(
		initialPayload.remainingPlayers !== null
			? String(initialPayload.remainingPlayers)
			: ""
	);
	const [totalEntries, setTotalEntries] = useState(
		initialPayload.totalEntries !== null
			? String(initialPayload.totalEntries)
			: ""
	);
	const [chipPurchases, setChipPurchases] = useState<
		Array<{ name: string; cost: number; chips: number }>
	>(initialPayload.chipPurchases);
	const [time, setTime] = useState(
		initialOccurredAt ? toTimeInputValue(initialOccurredAt) : ""
	);

	const [sheetOpen, setSheetOpen] = useState(false);
	const [editingPurchase, setEditingPurchase] =
		useState<EditingPurchase | null>(null);

	const openAddSheet = () => {
		setEditingPurchase(null);
		setSheetOpen(true);
	};

	const openEditSheet = (index: number) => {
		const p = chipPurchases[index];
		if (p) {
			setEditingPurchase({ index, name: p.name, cost: p.cost, chips: p.chips });
			setSheetOpen(true);
		}
	};

	const handleSheetSubmit = (purchase: {
		name: string;
		cost: number;
		chips: number;
	}) => {
		if (editingPurchase !== null) {
			setChipPurchases((prev) =>
				prev.map((p, i) => (i === editingPurchase.index ? purchase : p))
			);
		} else {
			setChipPurchases((prev) => [...prev, purchase]);
		}
		setSheetOpen(false);
	};

	const handleSheetDelete = () => {
		if (editingPurchase !== null) {
			setChipPurchases((prev) =>
				prev.filter((_, i) => i !== editingPurchase.index)
			);
		}
		setSheetOpen(false);
	};

	const handleRemove = (index: number) => {
		setChipPurchases((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSave = () => {
		const payload: TournamentStackRecordPayload = {
			stackAmount: Number(stackAmount),
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			totalEntries: totalEntries ? Number(totalEntries) : null,
			chipPurchases,
			chipPurchaseCounts: initialPayload.chipPurchaseCounts,
		};
		let occurredAt: number | undefined;
		if (initialOccurredAt && time) {
			const newDate = applyTimeToDate(initialOccurredAt, time);
			occurredAt = Math.floor(newDate.getTime() / 1000);
		}
		onSubmit(payload, occurredAt);
	};

	const timeError =
		initialOccurredAt && time
			? validateTime(time, initialOccurredAt, minTime, maxTime)
			: null;

	return (
		<div className="flex flex-col gap-4">
			{initialOccurredAt && (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="edit-time">Time</Label>
					<Input
						id="edit-time"
						onChange={(e) => setTime(e.target.value)}
						type="time"
						value={time}
					/>
					{timeError && <p className="text-destructive text-xs">{timeError}</p>}
				</div>
			)}

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-stackAmount">Stack Amount</Label>
				<Input
					id="edit-stackAmount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStackAmount(e.target.value)}
					required
					type="number"
					value={stackAmount}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-remainingPlayers">Remaining Players</Label>
				<Input
					id="edit-remainingPlayers"
					inputMode="numeric"
					min={1}
					onChange={(e) => setRemainingPlayers(e.target.value)}
					type="number"
					value={remainingPlayers}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-totalEntries">Total Entries</Label>
				<Input
					id="edit-totalEntries"
					inputMode="numeric"
					min={1}
					onChange={(e) => setTotalEntries(e.target.value)}
					type="number"
					value={totalEntries}
				/>
			</div>

			<ChipPurchaseList
				onAdd={openAddSheet}
				onEdit={openEditSheet}
				onRemove={handleRemove}
				purchases={chipPurchases}
			/>

			{/* Actions */}
			<div className="flex flex-col gap-2">
				<Button
					disabled={isLoading || timeError !== null}
					onClick={handleSave}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={onDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>

			<ChipPurchaseSheet
				initialValues={
					editingPurchase
						? {
								name: editingPurchase.name,
								cost: editingPurchase.cost,
								chips: editingPurchase.chips,
							}
						: undefined
				}
				onDelete={editingPurchase !== null ? handleSheetDelete : undefined}
				onOpenChange={(open) => {
					if (!open) {
						setSheetOpen(false);
					}
				}}
				onSubmit={handleSheetSubmit}
				open={sheetOpen}
			/>
		</div>
	);
}
