import { AiExtractInput } from "@/features/rooms/components/tournament-form-sheet/ai-extract-input";
import {
	TournamentModalContent,
	type TournamentPartialFormValues,
} from "@/features/rooms/components/tournament-modal-content";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { FormSheet } from "@/shared/components/form-sheet";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
	type TournamentFormSheetMode,
	useTournamentFormSheet,
} from "./use-tournament-form-sheet";

interface TournamentFormSheetProps {
	aiMode?: TournamentFormSheetMode;
	/** Form id shared with the FormSheet Save button. Must be unique per sheet. */
	formId: string;
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

/**
 * V2 create/edit sheet for a tournament. Wraps {@link TournamentModalContent}
 * (Details / Structure tabs) in a {@link FormSheet} whose Save button submits
 * the inner form via `formId`. The AI auto-fill lives in a sibling action
 * Drawer since FormSheet has no header-action slot. The AI/reset state lives
 * in {@link useTournamentFormSheet}.
 */
export function TournamentFormSheet({
	aiMode,
	formId,
	initialBlindLevels,
	initialFormValues,
	isInitializing = false,
	isLoading,
	onOpenChange,
	onSave,
	open,
	resetKey,
	title,
}: TournamentFormSheetProps) {
	const {
		aiSheetOpen,
		setAiSheetOpen,
		aiKey,
		effectiveFormValues,
		effectiveLevels,
		contentKey,
		handleAiExtracted,
	} = useTournamentFormSheet({
		aiMode,
		initialBlindLevels,
		initialFormValues,
		open,
		resetKey,
	});

	return (
		<>
			{aiMode ? (
				<Drawer onOpenChange={setAiSheetOpen} open={aiSheetOpen}>
					<DrawerContent className="rounded-t-xl">
						<div
							aria-hidden
							className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
						/>
						<DrawerTitle className="t-h4 px-4 pt-1">
							Auto-fill with AI
						</DrawerTitle>
						<DrawerDescription className="sr-only">
							Extract tournament details from a URL or image.
						</DrawerDescription>
						<div className="overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
							<AiExtractInput onExtracted={handleAiExtracted} />
						</div>
					</DrawerContent>
				</Drawer>
			) : null}

			<FormSheet
				formId={formId}
				isLoading={isLoading}
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
						formId={formId}
						initialBlindLevels={effectiveLevels}
						initialFormValues={effectiveFormValues}
						key={contentKey}
						onOpenAi={aiMode ? () => setAiSheetOpen(true) : undefined}
						onSave={onSave}
					/>
				)}
			</FormSheet>
		</>
	);
}
