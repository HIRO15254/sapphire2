import { IconPlus, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD, CRYST_TAG, crystButton } from "../../cryst-controls";
import { CrystFormSheet } from "../cryst-form-sheet";
import { DiscardChangesDialog } from "../discard-changes-dialog";
import { MixGamesPickerSheet } from "./mix-games-picker-sheet";
import {
	type MixMasterRow,
	type SavedMix,
	useMixMasterSheet,
} from "./use-mix-master-sheet";

interface MixMasterSheetProps {
	editing: MixMasterRow | null;
	onOpenChange: (open: boolean) => void;
	onSaved: (saved: SavedMix) => void;
	open: boolean;
}

const FORM_ID = "cryst-mix-master-form";
const LABEL_ID = "cryst-mix-master-label";
const GAMES_LABEL_ID = "cryst-mix-master-games";
const GAMES_ERROR_ID = "cryst-mix-master-games-error";

export function MixMasterSheet({
	editing,
	onOpenChange,
	onSaved,
	open,
}: MixMasterSheetProps) {
	const sheet = useMixMasterSheet({ editing, onOpenChange, onSaved, open });
	const { form } = sheet;

	return (
		<>
			<CrystFormSheet
				formId={FORM_ID}
				isLoading={sheet.isSaving}
				onOpenChange={sheet.discard.onRequestClose}
				open={open}
				title={sheet.title}
			>
				<form
					className="flex flex-col gap-4"
					id={FORM_ID}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="label">
						{(field) => (
							<Field
								className="gap-0"
								error={sheet.nameError ?? field.state.meta.errors[0]?.message}
								htmlFor={LABEL_ID}
								label="Name"
								required
							>
								<input
									{...NO_INPUT_SUGGESTIONS}
									className={`${CRYST_FIELD} mt-1.5 box-border h-[var(--m-control)] w-full px-2.5`}
									id={LABEL_ID}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => {
										sheet.onNameChange();
										field.handleChange(e.target.value);
									}}
									type="text"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>

					<section
						aria-describedby={sheet.gamesError ? GAMES_ERROR_ID : undefined}
						aria-labelledby={GAMES_LABEL_ID}
						className="flex flex-col gap-2"
					>
						<div className="flex items-baseline justify-between gap-2">
							<span
								className="font-medium text-[length:var(--text-sm)] text-foreground"
								id={GAMES_LABEL_ID}
							>
								Games
								<span className="text-destructive"> *</span>
							</span>
							<span
								className="font-mono text-[length:var(--text-xs)] text-muted-foreground"
								role="status"
							>
								{sheet.summary}
							</span>
						</div>
						{sheet.groups.map((group) => (
							<fieldset
								aria-label={group.name}
								className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-2.5"
								key={group.key}
							>
								<span className="truncate font-semibold text-[length:var(--m-text-secondary)]">
									{group.name}
								</span>
								<div className="flex flex-wrap items-center gap-1.5">
									{group.games.map((game) => (
										<span
											className={cn(CRYST_TAG, "gap-1 pr-0.5 font-mono")}
											key={game.id}
											title={game.label}
										>
											{game.code}
											<button
												aria-label={`Remove ${game.label}`}
												className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
												onClick={() => sheet.onRemoveGame(game.id)}
												type="button"
											>
												<IconX aria-hidden size={12} />
											</button>
										</span>
									))}
								</div>
							</fieldset>
						))}
						<button
							className={crystButton({ variant: "outline" })}
							onClick={sheet.onOpenPicker}
							type="button"
						>
							<IconPlus aria-hidden size={16} />
							Add games
						</button>
						{sheet.gamesError ? (
							<p
								className="text-[length:var(--text-xs)] text-destructive"
								id={GAMES_ERROR_ID}
								role="alert"
							>
								{sheet.gamesError}
							</p>
						) : null}
					</section>

					<p className="text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
						{sheet.hint}
					</p>
				</form>
			</CrystFormSheet>
			<MixGamesPickerSheet
				isDisabled={sheet.picker.isDisabled}
				isPicked={sheet.picker.isPicked}
				onOpenChange={sheet.picker.onOpenChange}
				onToggle={sheet.picker.onToggle}
				open={sheet.picker.open}
			/>
			<DiscardChangesDialog
				onConfirmDiscard={sheet.discard.onConfirmDiscard}
				onOpenChange={sheet.discard.onCancelDiscard}
				open={sheet.discard.isConfirmOpen}
			/>
		</>
	);
}
