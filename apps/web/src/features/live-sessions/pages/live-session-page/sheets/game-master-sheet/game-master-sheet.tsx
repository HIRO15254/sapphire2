import { IconStack2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD } from "../../cryst-controls";
import { RadioCard, RadioCardGroup } from "../../radio-card";
import { CrystFormSheet } from "../cryst-form-sheet";
import { DiscardChangesDialog } from "../discard-changes-dialog";
import {
	type GameMasterRow,
	useGameMasterSheet,
} from "./use-game-master-sheet";

interface GameMasterSheetProps {
	editing: GameMasterRow | null;
	onOpenChange: (open: boolean) => void;
	onSaved: (label: string) => void;
	open: boolean;
}

const FORM_ID = "cryst-game-master-form";
const CONTROL_CLASS = `${CRYST_FIELD} mt-1.5 box-border h-[var(--m-control)] w-full px-2.5`;
const STRUCTURE_LABEL_ID = "cryst-game-master-structure";

const fieldId = (name: string) => `cryst-game-master-${name}`;

export function GameMasterSheet({
	editing,
	onOpenChange,
	onSaved,
	open,
}: GameMasterSheetProps) {
	const sheet = useGameMasterSheet({ editing, onOpenChange, onSaved, open });
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
								htmlFor={fieldId("label")}
								label="Name"
								required
							>
								<input
									{...NO_INPUT_SUGGESTIONS}
									className={CONTROL_CLASS}
									id={fieldId("label")}
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
					<form.Field name="shortLabel">
						{(field) => (
							<Field
								className="gap-0"
								error={field.state.meta.errors[0]?.message}
								htmlFor={fieldId("shortLabel")}
								label="Short name"
							>
								<input
									{...NO_INPUT_SUGGESTIONS}
									className={cn(CONTROL_CLASS, "font-mono")}
									id={fieldId("shortLabel")}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="text"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="groupId">
						{(field) => (
							<div className="flex flex-col gap-1.5">
								<span
									className="font-medium text-[length:var(--text-sm)] text-foreground"
									id={STRUCTURE_LABEL_ID}
								>
									Blind structure
									<span className="text-destructive"> *</span>
								</span>
								<RadioCardGroup
									aria-labelledby={STRUCTURE_LABEL_ID}
									onValueChange={field.handleChange}
									value={field.state.value}
								>
									{sheet.structures.map((structure) => (
										<RadioCard
											description={structure.slots}
											icon={IconStack2}
											key={structure.id}
											title={structure.label}
											value={structure.id}
										/>
									))}
								</RadioCardGroup>
								{field.state.meta.errors[0] ? (
									<p
										className="text-[length:var(--text-xs)] text-destructive"
										role="alert"
									>
										{field.state.meta.errors[0].message}
									</p>
								) : null}
							</div>
						)}
					</form.Field>
					<p className="text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
						{sheet.hint}
					</p>
				</form>
			</CrystFormSheet>
			<DiscardChangesDialog
				onConfirmDiscard={sheet.discard.onConfirmDiscard}
				onOpenChange={sheet.discard.onCancelDiscard}
				open={sheet.discard.isConfirmOpen}
			/>
		</>
	);
}
