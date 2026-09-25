import { IconArrowsShuffle, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { MixGameGroupRow } from "@/shared/lib/mix-games";
import { crystButton } from "../../cryst-controls";
import { CrystFormSheet } from "../cryst-form-sheet";
import { DiscardChangesDialog } from "../discard-changes-dialog";
import { GroupGamesSheet } from "./group-games-sheet";
import { MixGroupCard } from "./mix-group-card";
import {
	type MixEditorTarget,
	useMixEditorSheet,
} from "./use-mix-editor-sheet";

interface MixEditorSheetProps {
	groups: readonly MixGameGroupRow[];
	onOpenChange: (open: boolean) => void;
	onSave: (rows: MixGameGroupRow[]) => void;
	open: boolean;
	target: MixEditorTarget;
}

const FORM_ID = "cryst-mix-editor-form";

export function MixEditorSheet({
	groups,
	onOpenChange,
	onSave,
	open,
	target,
}: MixEditorSheetProps) {
	const editor = useMixEditorSheet({
		groups,
		onOpenChange,
		onSave,
		open,
		target,
	});

	return (
		<>
			<CrystFormSheet
				formId={FORM_ID}
				isSaveDisabled={!editor.canSave}
				onOpenChange={editor.discard.onRequestClose}
				open={open}
				title={editor.title}
			>
				<form
					className="flex flex-col gap-2.5"
					id={FORM_ID}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						editor.onSubmit();
					}}
				>
					<div
						className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-[length:var(--text-xs)]"
						role="status"
					>
						<IconArrowsShuffle
							aria-hidden
							className="shrink-0 text-info"
							size={15}
						/>
						<span className="min-w-0 flex-1 font-semibold">
							{editor.summary}
						</span>
						<span
							className={cn(
								"font-semibold",
								editor.validity.isValid ? "text-success" : "text-warning"
							)}
						>
							{editor.validity.label}
						</span>
					</div>

					{editor.groups.map((group) => (
						<MixGroupCard
							cells={group.cells}
							key={group.uid}
							name={group.name}
							number={group.number}
							onAddGames={() => editor.onOpenGames(group.uid)}
							onCellChange={(slot, value) =>
								editor.onCellChange(group.uid, slot, value)
							}
							onRemove={() => editor.onRemoveGroup(group.uid)}
							onRemoveVariant={(label) =>
								editor.onRemoveVariant(group.uid, label)
							}
							onRename={(name) => editor.onRenameGroup(group.uid, name)}
							onRenameEnd={() => editor.onRenameGroupEnd(group.uid)}
							variants={group.variants}
						/>
					))}

					<button
						className={crystButton({ variant: "outline" })}
						disabled={!editor.canAddGroup}
						onClick={editor.onAddGroup}
						type="button"
					>
						<IconPlus aria-hidden size={16} />
						Add group
					</button>
					<p className="text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
						{editor.hint}
					</p>
				</form>
			</CrystFormSheet>
			<GroupGamesSheet
				hint={editor.picker.hint}
				isDisabled={editor.picker.isDisabled}
				isPicked={editor.picker.isPicked}
				onOpenChange={editor.picker.onOpenChange}
				onToggle={editor.picker.onToggle}
				open={editor.picker.open}
			/>
			<DiscardChangesDialog
				onConfirmDiscard={editor.discard.onConfirmDiscard}
				onOpenChange={editor.discard.onCancelDiscard}
				open={editor.discard.isConfirmOpen}
			/>
		</>
	);
}
