import { useState } from "react";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";

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

interface EditingPurchase {
	chips: number;
	cost: number;
	index: number;
	name: string;
}

interface UseTournamentStackRecordEditorOptions {
	initialOccurredAt?: string | Date;
	initialPayload: TournamentStackRecordPayload;
	maxTime?: Date | null;
	minTime?: Date | null;
	onSubmit: (
		payload: TournamentStackRecordPayload,
		occurredAt?: number
	) => void;
}

export function useTournamentStackRecordEditor({
	initialOccurredAt,
	initialPayload,
	maxTime,
	minTime,
	onSubmit,
}: UseTournamentStackRecordEditorOptions) {
	const [stackAmount, setStackAmount] = useState(
		String(initialPayload.stackAmount)
	);
	const [remainingPlayers, setRemainingPlayers] = useState(
		initialPayload.remainingPlayers === null
			? ""
			: String(initialPayload.remainingPlayers)
	);
	const [totalEntries, setTotalEntries] = useState(
		initialPayload.totalEntries === null
			? ""
			: String(initialPayload.totalEntries)
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
		if (editingPurchase === null) {
			setChipPurchases((prev) => [...prev, purchase]);
		} else {
			setChipPurchases((prev) =>
				prev.map((p, i) => (i === editingPurchase.index ? purchase : p))
			);
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

	return {
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
	};
}
