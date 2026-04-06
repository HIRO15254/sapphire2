import { useState } from "react";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import {
	StackBadgeRow,
	StackEditorActionRow,
	StackNumberField,
	StackSectionHeader,
	StackTimeField,
} from "@/live-sessions/components/stack-ui";
import { ChipPurchaseSheet } from "@/live-sessions/components/chip-purchase-sheet";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

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
			<StackSectionHeader
				action={
					<Button onClick={onAdd} size="xs" type="button" variant="ghost">
						+ Add
					</Button>
				}
				title="Chip Purchases"
			/>
			{purchases.length > 0 ? (
				<StackBadgeRow className="pb-0">
					{purchases.map((purchase, i) => (
						<Button
							className={cn("h-auto rounded-full px-2 py-1 text-xs")}
							key={`${purchase.name}-${String(i)}-badge`}
							onClick={() => onEdit(i)}
							size="xs"
							type="button"
							variant="secondary"
						>
							{purchase.name}: {purchase.cost}
						</Button>
					))}
				</StackBadgeRow>
			) : null}
			{purchases.map((purchase, i) => (
				<div
					className="flex items-center justify-between"
					key={`${purchase.name}-${String(i)}-meta`}
				>
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
				<StackTimeField error={timeError} onChange={setTime} value={time} />
			)}

			<StackNumberField
				id="edit-stackAmount"
				inputMode="numeric"
				label="Stack Amount"
				min={0}
				onChange={setStackAmount}
				required
				type="number"
				value={stackAmount}
			/>

			<StackNumberField
				id="edit-remainingPlayers"
				inputMode="numeric"
				label="Remaining Players"
				min={1}
				onChange={setRemainingPlayers}
				type="number"
				value={remainingPlayers}
			/>

			<StackNumberField
				id="edit-totalEntries"
				inputMode="numeric"
				label="Total Entries"
				min={1}
				onChange={setTotalEntries}
				type="number"
				value={totalEntries}
			/>

			<ChipPurchaseList
				onAdd={openAddSheet}
				onEdit={openEditSheet}
				onRemove={handleRemove}
				purchases={chipPurchases}
			/>

			<StackEditorActionRow
				isLoading={isLoading}
				onDelete={onDelete}
				onSave={handleSave}
				saveDisabled={timeError !== null}
			/>

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
