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
import type {
	AcceptedMediaType,
	SessionParam,
} from "@/features/live-sessions/utils/seat-screenshot";
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

const MAX_IMAGES = 5;

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

function describeScan(imageCount: number, scannedAt: Date | null): string {
	const label = imageCount > 1 ? `${imageCount} screenshots` : "Screenshot";
	return scannedAt === null ? label : `${label} ${formatLocalHm(scannedAt)}`;
}

function seatLabelOf(seatPosition: number) {
	return `S${seatPosition + 1}`;
}

function committedNameOf(row: ScanRow): string {
	if (row.kind === "vacate") {
		return row.currentName === null ? "Empty" : `${row.currentName} left`;
	}
	return row.name === "" ? "You" : row.name;
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
	const [imageCount, setImageCount] = useState(0);
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
			setImageCount(0);
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
				row.kind === "vacate" ||
				row.matchedPlayerId !== null ||
				row.name.trim() !== "")
	);
	const conflicts = resolved.filter(
		(row) => row.kind === "conflict" || row.kind === "vacate"
	);
	const isAllSelected =
		pickable.length > 0 && selected.length === pickable.length;

	const setRowSelected = (seatPosition: number, isSelected: boolean) => {
		setSelection((prev) => ({ ...prev, [seatPosition]: isSelected }));
	};

	const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = [...(e.target.files ?? [])];
		e.target.value = "";
		if (files.length === 0) {
			return;
		}
		if (!files.every((file) => isAcceptedMediaType(file.type))) {
			toast.error("Only JPEG, PNG, GIF, or WEBP images are supported.");
			return;
		}
		if (files.length > MAX_IMAGES) {
			toast.error(`Choose up to ${MAX_IMAGES} images at once.`);
			return;
		}
		setStep("busy");
		setImageCount(files.length);
		try {
			const sources = await Promise.all(
				files.map(async (file) => ({
					data: await fileToBase64(file),
					kind: "image" as const,
					mediaType: file.type as AcceptedMediaType,
				}))
			);
			const result = await extractMutation.mutateAsync({
				sourceApp: SOURCE_APP,
				sources,
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
			toast.error(
				files.length === 1
					? "Could not read the image."
					: "Could not read the images."
			);
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
		const context = {
			activePlayerIds: new Set(activePlayerIds),
			incomingPlayerIds: new Set(
				selected
					.map((row) => row.matchedPlayerId)
					.filter((id): id is string => id !== null)
			),
			isHeroMoving: selected.some((row) => row.kind === "hero"),
		};
		for (const row of selected) {
			const ok = await applyScanRow(row, sessionParam, context);
			if (ok) {
				applied.push({
					name: committedNameOf(row),
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
				: `${conflicts.length} seats disagree with the table — choose Keep or Replace.`,
		detectedText: `${countDetectedSeats(rows)} of ${seats.length} seats detected`,
		fileInputRef,
		isApplying,
		keptText: `${rows.length - committed.length} seats`,
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
		scannedAtText: describeScan(imageCount, scannedAt),
		selectAllLabel: isAllSelected ? "Clear all" : "Select all",
		selectedCount: selected.length,
		step,
		summaryText: `${selected.length} to register · ${rows.length - selected.length} left as-is`,
	};
}
