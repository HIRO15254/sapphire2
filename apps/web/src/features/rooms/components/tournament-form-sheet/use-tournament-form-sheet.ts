import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { mergeExtractedTournamentData } from "@/features/rooms/utils/merge-extracted-tournament-data";

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

export type TournamentFormSheetMode = "create" | "edit";

interface UseTournamentFormSheetOptions {
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	open: boolean;
	resetKey?: string;
}

export function useTournamentFormSheet({
	initialBlindLevels,
	initialFormValues,
	open,
	resetKey,
}: UseTournamentFormSheetOptions) {
	const [aiSheetOpen, setAiSheetOpen] = useState(false);
	const [aiFormValues, setAiFormValues] = useState<
		TournamentPartialFormValues | undefined
	>();
	const [aiBlindLevels, setAiBlindLevels] = useState<BlindLevelRow[]>([]);
	const [aiKey, setAiKey] = useState(0);

	// 現在フォームに入力されている値を AI 抽出時に取得するための getter。
	// AI が空白を返しても既にユーザーが入力済みの情報を上書きしないよう、
	// initialFormValues ではなく「現在のフォーム値」を merge のベースに使う（SA2-77）。
	const liveValuesGetterRef = useRef<
		(() => TournamentPartialFormValues) | null
	>(null);
	const registerLiveValues = useCallback(
		(getter: () => TournamentPartialFormValues) => {
			liveValuesGetterRef.current = getter;
		},
		[]
	);

	useEffect(() => {
		if (!open) {
			setAiFormValues(undefined);
			setAiBlindLevels([]);
			setAiKey(0);
			setAiSheetOpen(false);
		}
	}, [open]);

	const handleAiExtracted = (data: ExtractedTournamentData) => {
		const base = liveValuesGetterRef.current?.() ?? initialFormValues;
		const extractedLevels = extractedToBlindLevels(data);
		setAiFormValues(mergeExtractedTournamentData(data, base));
		setAiBlindLevels(
			extractedLevels.length > 0 ? extractedLevels : initialBlindLevels
		);
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
		registerLiveValues,
	};
}
