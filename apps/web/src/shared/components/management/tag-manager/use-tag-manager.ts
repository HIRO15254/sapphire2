import { useState } from "react";

interface UseTagManagerResult<TTag> {
	deletingTag: TTag | null;
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
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<TTag | null>(null);
	const [deletingTag, setDeletingTag] = useState<TTag | null>(null);

	return {
		deletingTag,
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
