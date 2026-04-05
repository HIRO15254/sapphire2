import { useState } from "react";
import { AllInBottomSheet } from "@/components/live-sessions/all-in-bottom-sheet";
import { EventBadge } from "@/components/live-sessions/event-badge";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/components/live-sessions/stack-editor-time";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AllIn {
	equity: number;
	id: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface StackRecordPayload {
	allIns: Array<{
		equity: number;
		potSize: number;
		trials: number;
		wins: number;
	}>;
	stackAmount: number;
}

interface StackRecordEditorProps {
	initialOccurredAt?: string | Date;
	initialPayload: StackRecordPayload;
	isLoading: boolean;
	maxTime?: Date | null;
	minTime?: Date | null;
	onDelete: () => void;
	onSubmit: (payload: StackRecordPayload, occurredAt?: number) => void;
}

export function StackRecordEditor({
	initialOccurredAt,
	initialPayload,
	isLoading,
	maxTime,
	minTime,
	onDelete,
	onSubmit,
}: StackRecordEditorProps) {
	const [stackAmount, setStackAmount] = useState(
		String(initialPayload.stackAmount)
	);
	const [allIns, setAllIns] = useState<AllIn[]>(() =>
		(initialPayload.allIns ?? []).map((ai, i) => ({ ...ai, id: i + 1 }))
	);
	const [time, setTime] = useState(
		initialOccurredAt ? toTimeInputValue(initialOccurredAt) : ""
	);

	const [allInSheetOpen, setAllInSheetOpen] = useState(false);
	const [editingAllIn, setEditingAllIn] = useState<AllIn | null>(null);

	let nextId = allIns.length > 0 ? Math.max(...allIns.map((a) => a.id)) : 0;

	const handleAllInSubmit = (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => {
		if (editingAllIn === null) {
			nextId += 1;
			setAllIns((prev) => [...prev, { ...values, id: nextId }]);
		} else {
			setAllIns((prev) =>
				prev.map((item) =>
					item.id === editingAllIn.id ? { ...values, id: item.id } : item
				)
			);
		}
		setAllInSheetOpen(false);
		setEditingAllIn(null);
	};

	const handleAllInDelete = () => {
		if (editingAllIn !== null) {
			setAllIns((prev) => prev.filter((item) => item.id !== editingAllIn.id));
		}
		setAllInSheetOpen(false);
		setEditingAllIn(null);
	};

	const handleSave = () => {
		const payload: StackRecordPayload = {
			stackAmount: Number(stackAmount),
			allIns: allIns.map(({ potSize, trials, equity, wins }) => ({
				potSize,
				trials,
				equity,
				wins,
			})),
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

			{/* All-ins */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<Label>All-ins</Label>
					<Button
						onClick={() => {
							setEditingAllIn(null);
							setAllInSheetOpen(true);
						}}
						size="xs"
						type="button"
						variant="ghost"
					>
						+ All-in
					</Button>
				</div>
				{allIns.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{allIns.map((allIn) => (
							<EventBadge
								data={{
									potSize: allIn.potSize,
									trials: allIn.trials,
									equity: allIn.equity,
									wins: allIn.wins,
								}}
								key={allIn.id}
								onEdit={() => {
									setEditingAllIn(allIn);
									setAllInSheetOpen(true);
								}}
								type="all-in"
							/>
						))}
					</div>
				)}
			</div>

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

			<AllInBottomSheet
				initialValues={editingAllIn ?? undefined}
				onDelete={editingAllIn !== null ? handleAllInDelete : undefined}
				onOpenChange={setAllInSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInSheetOpen}
			/>
		</div>
	);
}
