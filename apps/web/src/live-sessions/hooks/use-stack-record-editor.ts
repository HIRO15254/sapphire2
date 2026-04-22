import { useState } from "react";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";

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

interface UseStackRecordEditorOptions {
	initialOccurredAt?: string | Date;
	initialPayload: StackRecordPayload;
	maxTime?: Date | null;
	minTime?: Date | null;
	onSubmit: (payload: StackRecordPayload, occurredAt?: number) => void;
}

export function useStackRecordEditor({
	initialOccurredAt,
	initialPayload,
	maxTime,
	minTime,
	onSubmit,
}: UseStackRecordEditorOptions) {
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

	return {
		stackAmount,
		setStackAmount,
		allIns,
		time,
		setTime,
		allInSheetOpen,
		setAllInSheetOpen,
		editingAllIn,
		setEditingAllIn,
		handleAllInSubmit,
		handleAllInDelete,
		handleSave,
		timeError,
	};
}
