import { useState } from "react";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/components/live-sessions/stack-editor-time";
import { ChipPurchaseSheet } from "@/components/live-tournament/chip-purchase-sheet";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { Field } from "@/components/ui/field";
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
		const occurredAt = toOccurredAtTimestamp(initialOccurredAt, time);
		onSubmit(payload, occurredAt);
	};

	const timeError =
		initialOccurredAt && time
			? validateOccurredAtTime(time, initialOccurredAt, minTime, maxTime)
			: null;

	return (
		<div className="flex flex-col gap-4">
			{initialOccurredAt && (
				<Field error={timeError} htmlFor="edit-time" label="Time">
					<Input
						id="edit-time"
						onChange={(e) => setTime(e.target.value)}
						type="time"
						value={time}
					/>
				</Field>
			)}

			<Field htmlFor="edit-stackAmount" label="Stack Amount" required>
				<Input
					id="edit-stackAmount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStackAmount(e.target.value)}
					required
					type="number"
					value={stackAmount}
				/>
			</Field>

			<Field htmlFor="edit-remainingPlayers" label="Remaining Players">
				<Input
					id="edit-remainingPlayers"
					inputMode="numeric"
					min={1}
					onChange={(e) => setRemainingPlayers(e.target.value)}
					type="number"
					value={remainingPlayers}
				/>
			</Field>

			<Field htmlFor="edit-totalEntries" label="Total Entries">
				<Input
					id="edit-totalEntries"
					inputMode="numeric"
					min={1}
					onChange={(e) => setTotalEntries(e.target.value)}
					type="number"
					value={totalEntries}
				/>
			</Field>

			<ChipPurchaseList
				onAdd={openAddSheet}
				onEdit={openEditSheet}
				onRemove={handleRemove}
				purchases={chipPurchases}
			/>

			{/* Actions */}
			<DialogActionRow>
				<Button onClick={onDelete} type="button" variant="destructive">
					Delete
				</Button>
				<Button
					disabled={isLoading || timeError !== null}
					onClick={handleSave}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
			</DialogActionRow>

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
