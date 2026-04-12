import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import type * as React from "react";
import { useState } from "react";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface TagManagerProps<TTag extends { id: string; name: string }> {
	deleteError?: React.ReactNode;
	emptyDescription?: React.ReactNode;
	emptyHeading?: React.ReactNode;
	isDeletePending?: boolean;
	noun?: string;
	onDelete: (id: string) => Promise<unknown>;
	renderCreateForm: (onClose: () => void) => React.ReactNode;
	renderDeleteDescription: (tag: TTag) => React.ReactNode;
	renderEditForm: (tag: TTag, onClose: () => void) => React.ReactNode;
	renderTagLabel?: (tag: TTag) => React.ReactNode;
	tags: TTag[];
}

export function TagManager<TTag extends { id: string; name: string }>({
	tags,
	deleteError,
	emptyDescription,
	emptyHeading = "No tags yet",
	isDeletePending = false,
	noun = "tag",
	onDelete,
	renderTagLabel,
	renderDeleteDescription,
	renderCreateForm,
	renderEditForm,
}: TagManagerProps<TTag>) {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<TTag | null>(null);
	const [deletingTag, setDeletingTag] = useState<TTag | null>(null);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					{tags.length} {tags.length === 1 ? noun : `${noun}s`}
				</p>
				<Button onClick={() => setIsCreateOpen(true)} size="sm">
					<IconPlus size={16} />
					New {noun.charAt(0).toUpperCase() + noun.slice(1)}
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
										onClick={() => setEditingTag(tag)}
										size="sm"
										variant="ghost"
									>
										<IconEdit size={16} />
									</Button>
									<Button
										aria-label={`Delete ${noun} ${tag.name}`}
										onClick={() => setDeletingTag(tag)}
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

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title={`New ${noun.charAt(0).toUpperCase() + noun.slice(1)}`}
			>
				{renderCreateForm(() => setIsCreateOpen(false))}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingTag(null);
					}
				}}
				open={editingTag !== null}
				title={`Edit ${noun.charAt(0).toUpperCase() + noun.slice(1)}`}
			>
				{editingTag && renderEditForm(editingTag, () => setEditingTag(null))}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setDeletingTag(null);
					}
				}}
				open={deletingTag !== null}
				title={`Delete ${noun.charAt(0).toUpperCase() + noun.slice(1)}`}
			>
				{deletingTag && (
					<div className="flex flex-col gap-4">
						{renderDeleteDescription(deletingTag)}
						{deleteError ? (
							<Alert variant="destructive">
								<AlertDescription>{deleteError}</AlertDescription>
							</Alert>
						) : null}
						<DialogActionRow>
							<Button onClick={() => setDeletingTag(null)} variant="outline">
								Cancel
							</Button>
							<Button
								disabled={isDeletePending}
								onClick={() =>
									onDelete(deletingTag.id)
										.then(() => setDeletingTag(null))
										.catch(() => {
											// Error handled by caller via deleteError prop
										})
								}
								variant="destructive"
							>
								{isDeletePending ? "Deleting..." : "Delete"}
							</Button>
						</DialogActionRow>
					</div>
				)}
			</ResponsiveDialog>
		</div>
	);
}
