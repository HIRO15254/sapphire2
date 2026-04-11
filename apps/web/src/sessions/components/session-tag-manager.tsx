import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { useSessionTags } from "@/sessions/hooks/use-session-tags";
import { SimpleEditableList } from "@/shared/components/management/simple-editable-list";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export function SessionTagManager() {
	const {
		tags,
		create,
		update,
		delete: deleteTag,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
	} = useSessionTags();

	const [isCreating, setIsCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const handleCreate = () => {
		if (!newName.trim()) {
			return;
		}
		create(newName.trim()).then(() => {
			setIsCreating(false);
			setNewName("");
		});
	};

	const handleCancelCreate = () => {
		setIsCreating(false);
		setNewName("");
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					{tags.length} {tags.length === 1 ? "tag" : "tags"}
				</p>
				<Button
					onClick={() => {
						setIsCreating(true);
						setEditingId(null);
						setEditingName("");
						setConfirmingDeleteId(null);
					}}
					size="sm"
				>
					<IconPlus size={16} />
					New Tag
				</Button>
			</div>

			{isCreating && (
				<div className="flex items-center gap-2">
					<Input
						autoFocus
						className="h-7 flex-1 text-sm"
						maxLength={50}
						onChange={(e) => setNewName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && newName.trim()) {
								handleCreate();
							}
							if (e.key === "Escape") {
								handleCancelCreate();
							}
						}}
						placeholder="Tag name"
						value={newName}
					/>
					<Button
						aria-label="Save tag"
						disabled={!newName.trim() || isCreatePending}
						onClick={handleCreate}
						size="sm"
						variant="ghost"
					>
						<IconCheck size={14} />
					</Button>
					<Button
						aria-label="Cancel"
						onClick={handleCancelCreate}
						size="sm"
						variant="ghost"
					>
						<IconX size={14} />
					</Button>
				</div>
			)}

			<SimpleEditableList
				confirmingDeleteId={confirmingDeleteId}
				editingId={editingId}
				editingValue={editingName}
				emptyDescription="Create tags when recording sessions."
				emptyHeading="No session tags yet"
				getItemLabel={(tag) => tag.name}
				isDeleting={isDeletePending}
				isSaving={isUpdatePending}
				itemNoun="tag"
				items={tags}
				onCancelDelete={() => setConfirmingDeleteId(null)}
				onCancelEditing={() => {
					setEditingId(null);
					setEditingName("");
				}}
				onConfirmDelete={(tag) =>
					deleteTag(tag.id).then(() => setConfirmingDeleteId(null))
				}
				onEditingValueChange={setEditingName}
				onSaveEditing={(tag) => {
					if (!editingName.trim()) {
						return;
					}
					update({ id: tag.id, name: editingName.trim() }).then(() => {
						setEditingId(null);
						setEditingName("");
					});
				}}
				onStartDeleting={(tag) => setConfirmingDeleteId(tag.id)}
				onStartEditing={(tag) => {
					setEditingId(tag.id);
					setEditingName(tag.name);
					setConfirmingDeleteId(null);
					setIsCreating(false);
					setNewName("");
				}}
			/>
		</div>
	);
}
