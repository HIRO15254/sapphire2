import {
	StackBadgeRow,
	StackEditorActionRow,
	StackNumberField,
	StackSectionHeader,
	StackTimeField,
} from "@/features/live-sessions/components/stack-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useTournamentStackRecordEditor } from "./use-tournament-stack-record-editor";

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
	onSubmit: (
		payload: TournamentStackRecordPayload,
		occurredAt?: number
	) => void;
}

interface InlineChipPurchaseSheetProps {
	initialValues?: { name: string; cost: number; chips: number };
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (purchase: { name: string; cost: number; chips: number }) => void;
	open: boolean;
}

function InlineChipPurchaseSheet({
	initialValues,
	onDelete,
	onOpenChange,
	onSubmit,
	open,
}: InlineChipPurchaseSheetProps) {
	return (
		<ResponsiveDialog
			onOpenChange={onOpenChange}
			open={open}
			title={initialValues ? "Edit Chip Purchase" : "Add Chip Purchase"}
		>
			<InlineChipPurchaseForm
				initialValues={initialValues}
				onCancel={() => onOpenChange(false)}
				onDelete={onDelete}
				onSubmit={(values) => {
					onSubmit(values);
					onOpenChange(false);
				}}
			/>
		</ResponsiveDialog>
	);
}

function InlineChipPurchaseForm({
	initialValues,
	onCancel,
	onDelete,
	onSubmit,
}: {
	initialValues?: { name: string; cost: number; chips: number };
	onCancel: () => void;
	onDelete?: () => void;
	onSubmit: (purchase: { name: string; cost: number; chips: number }) => void;
}) {
	return (
		<div className="flex flex-col gap-3">
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					const name = String(fd.get("name") ?? "").trim();
					const cost = Number(fd.get("cost") ?? 0);
					const chips = Number(fd.get("chips") ?? 0);
					if (!name) {
						return;
					}
					onSubmit({ name, cost, chips });
				}}
			>
				<Field htmlFor="ip-name" label="Name" required>
					<Input
						defaultValue={initialValues?.name ?? ""}
						id="ip-name"
						name="name"
					/>
				</Field>
				<Field htmlFor="ip-cost" label="Cost" required>
					<Input
						defaultValue={String(initialValues?.cost ?? 0)}
						id="ip-cost"
						inputMode="numeric"
						name="cost"
					/>
				</Field>
				<Field htmlFor="ip-chips" label="Chips Received" required>
					<Input
						defaultValue={String(initialValues?.chips ?? 0)}
						id="ip-chips"
						inputMode="numeric"
						name="chips"
					/>
				</Field>
				<div className="flex justify-end gap-2">
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
					{onDelete && (
						<Button onClick={onDelete} type="button" variant="destructive">
							Delete
						</Button>
					)}
					<Button type="submit">{initialValues ? "Save" : "Add"}</Button>
				</div>
			</form>
		</div>
	);
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
	onSubmit,
}: TournamentStackRecordEditorProps) {
	const {
		stackAmount,
		setStackAmount,
		remainingPlayers,
		setRemainingPlayers,
		totalEntries,
		setTotalEntries,
		chipPurchases,
		time,
		setTime,
		sheetOpen,
		setSheetOpen,
		editingPurchase,
		openAddSheet,
		openEditSheet,
		handleSheetSubmit,
		handleSheetDelete,
		handleRemove,
		handleSave,
		timeError,
	} = useTournamentStackRecordEditor({
		initialOccurredAt,
		initialPayload,
		maxTime,
		minTime,
		onSubmit,
	});

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
				onSave={handleSave}
				saveDisabled={timeError !== null}
			/>

			<InlineChipPurchaseSheet
				initialValues={
					editingPurchase
						? {
								name: editingPurchase.name,
								cost: editingPurchase.cost,
								chips: editingPurchase.chips,
							}
						: undefined
				}
				onDelete={editingPurchase === null ? undefined : handleSheetDelete}
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
