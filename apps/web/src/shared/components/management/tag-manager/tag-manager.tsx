import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import type * as React from "react";
import { FormSheet } from "@/shared/components/form-sheet";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useTagManager } from "./use-tag-manager";

const CREATE_FORM_ID = "tag-create-form";
const EDIT_FORM_ID = "tag-edit-form";

interface TagManagerProps<TTag extends { id: string; name: string }> {
	deleteError?: React.ReactNode;
	emptyDescription?: React.ReactNode;
	emptyHeading?: React.ReactNode;
	isCreatePending?: boolean;
	isDeletePending?: boolean;
	isEditPending?: boolean;
	noun?: string;
	onDelete: (id: string) => Promise<unknown>;
	/**
	 * Renders the create form body. The form must set `id={formId}` on its
	 * `<form>` element and render no submit button — the surrounding
	 * `FormSheet` toolbar submits it via the HTML `form` attribute.
	 */
	renderCreateForm: (formId: string, onClose: () => void) => React.ReactNode;
	renderDeleteDescription: (tag: TTag) => React.ReactNode;
	/** Same `formId` contract as `renderCreateForm`. */
	renderEditForm: (
		tag: TTag,
		formId: string,
		onClose: () => void
	) => React.ReactNode;
	renderTagLabel?: (tag: TTag) => React.ReactNode;
	tags: TTag[];
}

export function TagManager<TTag extends { id: string; name: string }>({
	tags,
	deleteError,
	emptyDescription,
	emptyHeading = "No tags yet",
	isCreatePending = false,
	isDeletePending = false,
	isEditPending = false,
	noun = "tag",
	onDelete,
	renderTagLabel,
	renderDeleteDescription,
	renderCreateForm,
	renderEditForm,
}: TagManagerProps<TTag>) {
	const {
		deletingTag,
		editingTag,
		isCreateOpen,
		onCloseCreate,
		onCloseDelete,
		onCloseEdit,
		onOpenCreate,
		onStartDelete,
		onStartEdit,
	} = useTagManager<TTag>();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					{tags.length} {tags.length === 1 ? noun : `${noun}s`}
				</p>
				<Button onClick={onOpenCreate} size="sm">
					<IconPlus size={16} />
					New {noun}
				</Button>
			</div>

			{tags.length === 0 ? (
				<EmptyState
					className="border-none bg-transparent px-0 py-8"
					description={emptyDescription}
					heading={emptyHeading}
				/>
			) : (
				<ManagementList>
					{tags.map((tag) => (
						<ManagementListItem
							actions={
								<div className="flex gap-1">
									<Button
										aria-label={`Edit ${noun} ${tag.name}`}
										onClick={() => onStartEdit(tag)}
										size="sm"
										variant="ghost"
									>
										<IconEdit size={16} />
									</Button>
									<Button
										aria-label={`Delete ${noun} ${tag.name}`}
										onClick={() => onStartDelete(tag)}
										size="sm"
										variant="ghost"
									>
										<IconTrash size={16} />
									</Button>
								</div>
							}
							key={tag.id}
							title={renderTagLabel ? renderTagLabel(tag) : tag.name}
						/>
					))}
				</ManagementList>
			)}

			<FormSheet
				formId={CREATE_FORM_ID}
				isLoading={isCreatePending}
				onOpenChange={(open) => {
					if (!open) {
						onCloseCreate();
					}
				}}
				open={isCreateOpen}
				title={`New ${noun}`}
			>
				{renderCreateForm(CREATE_FORM_ID, onCloseCreate)}
			</FormSheet>

			<FormSheet
				formId={EDIT_FORM_ID}
				isLoading={isEditPending}
				onOpenChange={(open) => {
					if (!open) {
						onCloseEdit();
					}
				}}
				open={editingTag !== null}
				title={`Edit ${noun}`}
			>
				{editingTag && renderEditForm(editingTag, EDIT_FORM_ID, onCloseEdit)}
			</FormSheet>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onCloseDelete();
					}
				}}
				open={deletingTag !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete {noun}?</DialogTitle>
						<DialogDescription>
							{deletingTag ? renderDeleteDescription(deletingTag) : null}
						</DialogDescription>
					</DialogHeader>
					{deleteError ? (
						<Alert variant="destructive">
							<AlertDescription>{deleteError}</AlertDescription>
						</Alert>
					) : null}
					<DialogFooter className="flex-row justify-end gap-2">
						<Button onClick={onCloseDelete} type="button" variant="outline">
							Cancel
						</Button>
						<Button
							disabled={isDeletePending}
							onClick={() =>
								deletingTag &&
								onDelete(deletingTag.id)
									.then(() => onCloseDelete())
									.catch(() => {
										// Error handled by caller via deleteError prop
									})
							}
							type="button"
							variant="destructive"
						>
							{isDeletePending ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
