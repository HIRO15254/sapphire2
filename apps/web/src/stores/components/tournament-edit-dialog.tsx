import { IconSparkles } from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { AiExtractInput } from "@/stores/components/ai-extract-input";
import {
	TournamentModalContent,
	type TournamentPartialFormValues,
} from "@/stores/components/tournament-modal-content";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import { useTournamentEditDialog } from "@/stores/hooks/use-tournament-edit-dialog";
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
	const {
		aiSheetOpen,
		setAiSheetOpen,
		aiKey,
		effectiveFormValues,
		effectiveLevels,
		contentKey,
		handleAiExtracted,
	} = useTournamentEditDialog({
		aiMode,
		initialBlindLevels,
		initialFormValues,
		open,
		resetKey,
	});

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
