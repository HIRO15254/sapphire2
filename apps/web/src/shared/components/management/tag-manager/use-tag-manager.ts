import { useId, useState } from "react";

interface UseTagManagerResult<TTag> {
	createFormId: string;
	deletingTag: TTag | null;
	editFormId: string;
	editingTag: TTag | null;
	isCreateOpen: boolean;
	onCloseCreate: () => void;
	onCloseDelete: () => void;
	onCloseEdit: () => void;
	onOpenCreate: () => void;
	onStartDelete: (tag: TTag) => void;
	onStartEdit: (tag: TTag) => void;
}

export function useTagManager<
	TTag extends { id: string; name: string },
>(): UseTagManagerResult<TTag> {
	// Instance-unique form ids: two TagManager instances on one page must not
	// collide via the HTML `form=` attribute.
	const id = useId();
	const createFormId = `${id}-tag-create`;
	const editFormId = `${id}-tag-edit`;
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<TTag | null>(null);
	const [deletingTag, setDeletingTag] = useState<TTag | null>(null);

	return {
		createFormId,
		deletingTag,
		editFormId,
		editingTag,
		isCreateOpen,
		onCloseCreate: () => setIsCreateOpen(false),
		onCloseDelete: () => setDeletingTag(null),
		onCloseEdit: () => setEditingTag(null),
		onOpenCreate: () => setIsCreateOpen(true),
		onStartDelete: (tag) => setDeletingTag(tag),
		onStartEdit: (tag) => setEditingTag(tag),
	};
}
