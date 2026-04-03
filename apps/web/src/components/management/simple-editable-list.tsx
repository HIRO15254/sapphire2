import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import type * as React from "react";
import {
	ManagementList,
	ManagementListItem,
} from "@/components/management/management-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

interface IdentifiableItem {
	id: string;
}

interface SimpleEditableListProps<TItem extends IdentifiableItem> {
	confirmingDeleteId: string | null;
	deleteError?: React.ReactNode;
	editingId: string | null;
	editingValue: string;
	emptyDescription?: React.ReactNode;
	emptyHeading: React.ReactNode;
	getItemLabel: (item: TItem) => string;
	isDeleting?: boolean;
	isSaving?: boolean;
	itemNoun: string;
	items: TItem[];
	onCancelDelete: () => void;
	onCancelEditing: () => void;
	onConfirmDelete: (item: TItem) => void;
	onEditingValueChange: (value: string) => void;
	onSaveEditing: (item: TItem) => void;
	onStartDeleting: (item: TItem) => void;
	onStartEditing: (item: TItem) => void;
	renderItemLabel?: (item: TItem) => React.ReactNode;
}

function SimpleEditableList<TItem extends IdentifiableItem>({
	confirmingDeleteId,
	deleteError,
	editingId,
	editingValue,
	emptyDescription,
	emptyHeading,
	getItemLabel,
	isDeleting = false,
	isSaving = false,
	itemNoun,
	items,
	onCancelDelete,
	onCancelEditing,
	onConfirmDelete,
	onEditingValueChange,
	onSaveEditing,
	onStartDeleting,
	onStartEditing,
	renderItemLabel,
}: SimpleEditableListProps<TItem>) {
	if (items.length === 0) {
		return (
			<EmptyState
				className="border-none bg-transparent px-0 py-4"
				description={emptyDescription}
				heading={emptyHeading}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<ManagementList>
				{items.map((item) => {
					const itemLabel = getItemLabel(item);
					const isEditing = editingId === item.id;
					const isConfirmingDelete = confirmingDeleteId === item.id;
					let actions: React.ReactNode = null;

					if (isConfirmingDelete) {
						actions = (
							<div className="flex items-center gap-1">
								<span className="text-destructive text-xs">Delete?</span>
								<Button
									aria-label={`Confirm delete ${itemNoun}`}
									className="text-destructive hover:text-destructive"
									disabled={isDeleting}
									onClick={() => onConfirmDelete(item)}
									size="sm"
									variant="ghost"
								>
									<IconTrash size={14} />
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={onCancelDelete}
									size="sm"
									variant="ghost"
								>
									<IconX size={14} />
								</Button>
							</div>
						);
					} else if (!isEditing) {
						actions = (
							<div className="flex items-center gap-1">
								<Button
									aria-label={`Edit ${itemNoun}`}
									onClick={() => onStartEditing(item)}
									size="sm"
									variant="ghost"
								>
									<IconPencil size={14} />
								</Button>
								<Button
									aria-label={`Delete ${itemNoun}`}
									onClick={() => onStartDeleting(item)}
									size="sm"
									variant="ghost"
								>
									<IconTrash size={14} />
								</Button>
							</div>
						);
					}

					return (
						<ManagementListItem
							actions={actions}
							key={item.id}
							title={renderItemLabel ? renderItemLabel(item) : itemLabel}
						>
							{isEditing ? (
								<div className="flex items-center gap-2">
									<Input
										autoFocus
										className="h-7 flex-1 text-sm"
										onChange={(event) =>
											onEditingValueChange(event.target.value)
										}
										onKeyDown={(event) => {
											if (event.key === "Enter" && editingValue.trim()) {
												onSaveEditing(item);
											}
											if (event.key === "Escape") {
												onCancelEditing();
											}
										}}
										value={editingValue}
									/>
									<Button
										aria-label={`Save ${itemNoun}`}
										disabled={!editingValue.trim() || isSaving}
										onClick={() => onSaveEditing(item)}
										size="sm"
										variant="ghost"
									>
										<IconCheck size={14} />
									</Button>
									<Button
										aria-label="Cancel editing"
										onClick={onCancelEditing}
										size="sm"
										variant="ghost"
									>
										<IconX size={14} />
									</Button>
								</div>
							) : null}
						</ManagementListItem>
					);
				})}
			</ManagementList>

			{deleteError ? (
				<Alert variant="destructive">
					<AlertDescription>{deleteError}</AlertDescription>
				</Alert>
			) : null}
		</div>
	);
}

export { SimpleEditableList };
