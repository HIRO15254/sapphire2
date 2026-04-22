import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { useEffect, useState } from "react";
import type { TournamentEditDialogMode } from "@/stores/components/tournament-edit-dialog";
import type { TournamentPartialFormValues } from "@/stores/components/tournament-modal-content";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";

function extractedToBlindLevels(
	data: ExtractedTournamentData
): BlindLevelRow[] {
	return (data.blindLevels ?? []).map((l, i) => ({
		id: crypto.randomUUID(),
		tournamentId: "",
		level: i + 1,
		isBreak: l.isBreak,
		blind1: l.blind1 ?? null,
		blind2: l.blind2 ?? null,
		blind3: l.blind3 ?? null,
		ante: l.ante ?? null,
		minutes: l.minutes ?? null,
	}));
}

function extractedToCreateFormValues(
	data: ExtractedTournamentData
): TournamentPartialFormValues {
	return {
		name: data.name ?? "",
		buyIn: data.buyIn,
		entryFee: data.entryFee,
		startingStack: data.startingStack,
		tableSize: data.tableSize,
		chipPurchases: data.chipPurchases ?? [],
		variant: "nlh",
	};
}

function mergeExtractedIntoEditFormValues(
	data: ExtractedTournamentData,
	base: TournamentPartialFormValues | undefined
): TournamentPartialFormValues {
	return {
		...base,
		// Use || so empty strings fall back to the existing value
		name: data.name || base?.name || "",
		variant: base?.variant ?? "nlh",
		...(data.buyIn !== undefined && { buyIn: data.buyIn }),
		...(data.entryFee !== undefined && { entryFee: data.entryFee }),
		...(data.startingStack !== undefined && {
			startingStack: data.startingStack,
		}),
		...(data.tableSize !== undefined && { tableSize: data.tableSize }),
		...(data.chipPurchases?.length && { chipPurchases: data.chipPurchases }),
	};
}

interface UseTournamentEditDialogOptions {
	aiMode?: TournamentEditDialogMode;
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	open: boolean;
	resetKey?: string;
}

export function useTournamentEditDialog({
	aiMode,
	initialBlindLevels,
	initialFormValues,
	open,
	resetKey,
}: UseTournamentEditDialogOptions) {
	const [aiSheetOpen, setAiSheetOpen] = useState(false);
	const [aiFormValues, setAiFormValues] = useState<
		TournamentPartialFormValues | undefined
	>();
	const [aiBlindLevels, setAiBlindLevels] = useState<BlindLevelRow[]>([]);
	const [aiKey, setAiKey] = useState(0);

	useEffect(() => {
		if (!open) {
			setAiFormValues(undefined);
			setAiBlindLevels([]);
			setAiKey(0);
			setAiSheetOpen(false);
		}
	}, [open]);

	const handleAiExtracted = (data: ExtractedTournamentData) => {
		const extractedLevels = extractedToBlindLevels(data);
		if (aiMode === "create") {
			setAiFormValues(extractedToCreateFormValues(data));
			setAiBlindLevels(extractedLevels);
		} else {
			setAiFormValues(
				mergeExtractedIntoEditFormValues(data, initialFormValues)
			);
			setAiBlindLevels(
				extractedLevels.length > 0 ? extractedLevels : initialBlindLevels
			);
		}
		setAiKey((k) => k + 1);
		setAiSheetOpen(false);
	};

	const effectiveFormValues = aiKey > 0 ? aiFormValues : initialFormValues;
	const effectiveLevels = aiKey > 0 ? aiBlindLevels : initialBlindLevels;
	const contentKey = `${resetKey ?? "tournament"}-${aiKey}`;

	return {
		aiSheetOpen,
		setAiSheetOpen,
		aiKey,
		effectiveFormValues,
		effectiveLevels,
		contentKey,
		handleAiExtracted,
	};
}
