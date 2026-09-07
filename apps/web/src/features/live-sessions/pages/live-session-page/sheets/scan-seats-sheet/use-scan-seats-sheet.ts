import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
	ScanRow,
	ScanSeatState,
} from "@/features/live-sessions/utils/seat-scan-review";
import {
	buildScanRows,
	countDetectedSeats,
} from "@/features/live-sessions/utils/seat-scan-review";
import type { SessionParam } from "@/features/live-sessions/utils/seat-screenshot";
import {
	applyScanRow,
	fileToBase64,
	isAcceptedMediaType,
	SOURCE_APP_ENTRIES,
} from "@/features/live-sessions/utils/seat-screenshot";
import { formatLocalHm } from "@/utils/format-number";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

export type ScanStep = "busy" | "choose" | "done" | "review";

export interface CommittedSeat {
	name: string;
	seatLabel: string;
}

interface UseScanSeatsSheetOptions {
	activePlayerIds: readonly string[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	seats: readonly ScanSeatState[];
	sessionParam: SessionParam;
}

function firstSourceApp() {
	const entry = SOURCE_APP_ENTRIES[0];
	if (!entry) {
		throw new Error("No screenshot source apps are configured");
	}
	return entry[0];
}

const SOURCE_APP = firstSourceApp();

function seatLabelOf(seatPosition: number) {
	return `S${seatPosition + 1}`;
}

export function useScanSeatsSheet({
	activePlayerIds,
	onOpenChange,
	open,
	seats,
	sessionParam,
}: UseScanSeatsSheetOptions) {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<ScanStep>("choose");
	const [rows, setRows] = useState<ScanRow[]>([]);
	const [selection, setSelection] = useState<Record<number, boolean>>({});
	const [names, setNames] = useState<Record<number, string>>({});
	const [committed, setCommitted] = useState<CommittedSeat[]>([]);
	const [committedAt, setCommittedAt] = useState<Date | null>(null);
	const [scannedAt, setScannedAt] = useState<Date | null>(null);
	const [isApplying, setIsApplying] = useState(false);

	const playersQuery = useQuery({
		...trpc.player.list.queryOptions(),
		enabled: open,
	});
	const extractMutation = useMutation(
		trpc.aiExtract.extractTablePlayers.mutationOptions()
	);
	const extractReset = extractMutation.reset;

	useEffect(() => {
		if (open) {
			setStep("choose");
			setRows([]);
			setSelection({});
			setNames({});
			setCommitted([]);
			setCommittedAt(null);
			setScannedAt(null);
			setIsApplying(false);
			extractReset();
		}
	}, [extractReset, open]);

	const resolved = rows.map((row) => ({
		...row,
		isSelected: selection[row.seatPosition] ?? row.isSelectedByDefault,
		name: names[row.seatPosition] ?? row.name,
	}));
	const pickable = resolved.filter((row) => row.isPickable);
	const selected = pickable.filter(
		(row) =>
			row.isSelected &&
			(row.kind === "hero" ||
				row.matchedPlayerId !== null ||
				row.name.trim() !== "")
	);
	const conflicts = resolved.filter((row) => row.kind === "conflict");
	const isAllSelected =
		pickable.length > 0 && selected.length === pickable.length;

	const setRowSelected = (seatPosition: number, isSelected: boolean) => {
		setSelection((prev) => ({ ...prev, [seatPosition]: isSelected }));
	};

	const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}
		if (!isAcceptedMediaType(file.type)) {
			toast.error("Only JPEG, PNG, GIF, or WEBP images are supported.");
			return;
		}
		setStep("busy");
		try {
			const data = await fileToBase64(file);
			const result = await extractMutation.mutateAsync({
				sourceApp: SOURCE_APP,
				sources: [{ data, kind: "image", mediaType: file.type }],
			});
			setRows(
				buildScanRows({
					knownPlayers: playersQuery.data ?? [],
					scanned: result.seats,
					seats,
				})
			);
			setSelection({});
			setNames({});
			setScannedAt(new Date());
			setStep("review");
		} catch {
			toast.error("Could not read the image.");
			setStep("choose");
		}
	};

	const onCommit = async () => {
		if (selected.length === 0) {
			return;
		}
		setIsApplying(true);
		const applied: CommittedSeat[] = [];
		let failures = 0;
		const activeIds = new Set(activePlayerIds);
		const incomingIds = new Set(
			selected
				.map((row) => row.matchedPlayerId)
				.filter((id): id is string => id !== null)
		);
		for (const row of selected) {
			const ok = await applyScanRow(row, sessionParam, activeIds, incomingIds);
			if (ok) {
				applied.push({
					name: row.name === "" ? "You" : row.name,
					seatLabel: seatLabelOf(row.seatPosition),
				});
			} else {
				failures += 1;
			}
		}
		await invalidateTargets(queryClient, [
			{
				queryKey:
					trpc.sessionTablePlayer.list.queryOptions(sessionParam).queryKey,
			},
			{ queryKey: trpc.player.list.queryOptions().queryKey },
		]);
		setIsApplying(false);
		setCommitted(applied);
		setCommittedAt(new Date());
		setStep("done");
		if (failures > 0) {
			toast.error(
				`${failures} of ${selected.length} seats could not be saved.`
			);
		}
	};

	return {
		committed,
		committedAtText: committedAt === null ? "—" : formatLocalHm(committedAt),
		conflictNote:
			conflicts.length === 0
				? null
				: `${conflicts.length} seats already have a different player — choose Keep or Replace.`,
		detectedText: `${countDetectedSeats(rows)} of ${seats.length} seats detected`,
		fileInputRef,
		isApplying,
		keptText: `${rows.length - committed.length} seats`,
		onCancel: () => onOpenChange(false),
		onCommit,
		onDone: () => onOpenChange(false),
		onImageSelected,
		onNameChange: (seatPosition: number, name: string) => {
			setNames((prev) => ({ ...prev, [seatPosition]: name }));
		},
		onPickFile: () => fileInputRef.current?.click(),
		onRescan: () => setStep("choose"),
		onToggleAll: () => {
			const next: Record<number, boolean> = {};
			for (const row of pickable) {
				next[row.seatPosition] = !isAllSelected;
			}
			setSelection((prev) => ({ ...prev, ...next }));
		},
		onToggleRow: (seatPosition: number, isSelected: boolean) => {
			setRowSelected(seatPosition, isSelected);
		},
		rows: resolved,
		scannedAtText:
			scannedAt === null
				? "Screenshot"
				: `Screenshot ${formatLocalHm(scannedAt)}`,
		selectAllLabel: isAllSelected ? "Clear all" : "Select all",
		selectedCount: selected.length,
		step,
		summaryText: `${selected.length} to register · ${rows.length - selected.length} left as-is`,
	};
}
