import { AiExtractInput } from "@/features/rooms/components/tournament-form-sheet/ai-extract-input";
import {
	TournamentModalContent,
	type TournamentPartialFormValues,
} from "@/features/rooms/components/tournament-modal-content";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { FormSheet } from "@/shared/components/form-sheet";
import { QueryError } from "@/shared/components/query-error";
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
	editBlindLevelsError?: boolean;
	formId: string;
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	isInitializing?: boolean;
	isLoading: boolean;
	onOpenChange: (open: boolean) => void;
	onRetryBlindLevels?: () => void;
	onSave: (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => void | Promise<void>;
	open: boolean;
	resetKey?: string;
	sheetVariant?: "cryst" | "legacy";
	title: string;
}

export function TournamentFormSheet({
	aiMode,
	sheetVariant = "legacy",
	formId,
	initialBlindLevels,
	initialFormValues,
	isInitializing = false,
	isLoading,
	editBlindLevelsError = false,
	onRetryBlindLevels = () => undefined,
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
		registerLiveValues,
	} = useTournamentFormSheet({
		initialBlindLevels,
		initialFormValues,
		open,
		resetKey,
	});

	const formContent = (() => {
		if (editBlindLevelsError) {
			return (
				<QueryError
					message="Unable to load blind levels"
					onRetry={onRetryBlindLevels}
				/>
			);
		}
		if (isInitializing && aiKey === 0) {
			return (
				<p className="py-8 text-center text-muted-foreground text-sm">
					Loading...
				</p>
			);
		}
		return (
			<TournamentModalContent
				formId={formId}
				initialBlindLevels={effectiveLevels}
				initialFormValues={effectiveFormValues}
				key={contentKey}
				onOpenAi={aiMode ? () => setAiSheetOpen(true) : undefined}
				onRegisterLiveValues={aiMode ? registerLiveValues : undefined}
				onSave={onSave}
			/>
		);
	})();

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

			{sheetVariant === "cryst" ? (
				<BottomSheet
					cancelLabel="Cancel"
					confirmLabel="Save"
					contentClassName="h-[calc(100svh-2rem)]"
					formId={formId}
					isConfirmDisabled={editBlindLevelsError}
					isConfirmPending={isLoading}
					onOpenChange={onOpenChange}
					open={open}
					title={title}
				>
					{formContent}
				</BottomSheet>
			) : (
				<FormSheet
					formId={formId}
					isLoading={isLoading}
					isSaveDisabled={editBlindLevelsError}
					onOpenChange={onOpenChange}
					open={open}
					title={title}
				>
					{formContent}
				</FormSheet>
			)}
		</>
	);
}
