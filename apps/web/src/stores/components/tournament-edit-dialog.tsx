import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { IconSparkles } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { AiExtractInput } from "@/stores/components/ai-extract-input";
import {
	TournamentModalContent,
	type TournamentPartialFormValues,
} from "@/stores/components/tournament-modal-content";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";

export type TournamentEditDialogMode = "create" | "edit";

interface TournamentEditDialogProps {
	aiMode?: TournamentEditDialogMode;
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	isInitializing?: boolean;
	isLoading: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => void | Promise<void>;
	open: boolean;
	resetKey?: string;
	title: string;
}

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

export function TournamentEditDialog({
	aiMode,
	initialBlindLevels,
	initialFormValues,
	isInitializing = false,
	isLoading,
	onOpenChange,
	onSave,
	open,
	resetKey,
	title,
}: TournamentEditDialogProps) {
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

	const aiButton = aiMode ? (
		<Button
			onClick={() => setAiSheetOpen(true)}
			size="xs"
			type="button"
			variant="outline"
		>
			<IconSparkles size={12} />
			AI自動入力
			<Badge className="px-1 py-0 text-[10px]" variant="secondary">
				beta
			</Badge>
		</Button>
	) : undefined;

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

	return (
		<>
			{aiMode ? (
				<ResponsiveDialog
					onOpenChange={setAiSheetOpen}
					open={aiSheetOpen}
					title="AI自動入力"
				>
					<AiExtractInput onExtracted={handleAiExtracted} />
				</ResponsiveDialog>
			) : null}

			<ResponsiveDialog
				fullHeight
				headerAction={aiButton}
				onOpenChange={onOpenChange}
				open={open}
				title={title}
			>
				{isInitializing && aiKey === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						Loading...
					</p>
				) : (
					<TournamentModalContent
						initialBlindLevels={effectiveLevels}
						initialFormValues={effectiveFormValues}
						isLoading={isLoading}
						key={contentKey}
						onSave={onSave}
					/>
				)}
			</ResponsiveDialog>
		</>
	);
}
