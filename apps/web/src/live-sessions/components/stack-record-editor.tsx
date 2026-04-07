import { useState } from "react";
import { AllInBottomSheet } from "@/live-sessions/components/all-in-bottom-sheet";
import { EventBadge } from "@/live-sessions/components/event-badge";
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
import { Button } from "@/shared/components/ui/button";

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

			<div className="flex flex-col gap-2">
				<StackSectionHeader
					action={
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
					}
					title="All-ins"
				/>
				{allIns.length > 0 ? (
					<StackBadgeRow className="pb-0">
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
					</StackBadgeRow>
				) : null}
			</div>

			<StackEditorActionRow
				isLoading={isLoading}
				onDelete={onDelete}
				onSave={handleSave}
				saveDisabled={timeError !== null}
			/>

			<AllInBottomSheet
				initialValues={editingAllIn ?? undefined}
				onDelete={editingAllIn === null ? undefined : handleAllInDelete}
				onOpenChange={setAllInSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInSheetOpen}
			/>
		</div>
	);
}
