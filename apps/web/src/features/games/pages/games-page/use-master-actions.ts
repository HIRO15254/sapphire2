import { useState } from "react";
import {
	type MasterTarget,
	useArchiveGroup,
	useArchiveMix,
	useArchiveVariant,
	useDeleteGroup,
	useDeleteMix,
	useDeleteVariant,
	useRestoreGroup,
	useRestoreMix,
	useRestoreVariant,
} from "@/features/games/hooks/use-game-mutations";
import {
	blockedReason,
	findMaster,
	type Master,
	type MasterData,
	type MasterRef,
} from "@/features/games/utils/game-lists";
import { isActive, type MasterKind } from "@/features/games/utils/game-masters";

interface DialogRef extends MasterRef {
	mode: "delete" | "in-use";
}

function quietly(run: () => Promise<unknown>) {
	run().catch(() => undefined);
}

function dialogCopy(
	label: string,
	mode: DialogRef["mode"],
	archiveBlock: string | null
) {
	if (mode === "delete") {
		return {
			canConfirm: true,
			confirmLabel: "Delete",
			description: "This can’t be undone.",
			title: `Delete ${label}?`,
		};
	}
	return {
		canConfirm: archiveBlock === null,
		confirmLabel: "Archive instead",
		description: `It can’t be deleted. ${archiveBlock ?? "Archive it instead."}`,
		title: `${label} is in use`,
	};
}

function inUseArchiveBlock(
	data: MasterData,
	ref: MasterRef,
	item: Master
): string | null {
	if (!isActive(item)) {
		return "It’s already archived.";
	}
	return blockedReason(data, ref);
}

export function useMasterActions(
	data: MasterData,
	onEdit: (ref: MasterRef) => void
) {
	const [menu, setMenu] = useState<MasterRef | null>(null);
	const [dialog, setDialog] = useState<DialogRef | null>(null);
	const reasonFor = (kind: MasterKind) => (id: string) =>
		blockedReason(data, { id, kind });

	const archivers = {
		group: useArchiveGroup(reasonFor("group")),
		mix: useArchiveMix(),
		variant: useArchiveVariant(reasonFor("variant")),
	};
	const restorers = {
		group: useRestoreGroup(),
		mix: useRestoreMix(reasonFor("mix")),
		variant: useRestoreVariant(reasonFor("variant")),
	};
	const deleters = {
		group: useDeleteGroup(),
		mix: useDeleteMix(),
		variant: useDeleteVariant(),
	};

	const menuItem = findMaster(data, menu);
	const dialogItem = findMaster(data, dialog);
	const takeMenu = (): (MasterRef & MasterTarget) | null => {
		setMenu(null);
		return menu && menuItem ? { ...menu, label: menuItem.label } : null;
	};

	return {
		dialog:
			dialog && dialogItem
				? {
						...dialogCopy(
							dialogItem.label,
							dialog.mode,
							inUseArchiveBlock(data, dialog, dialogItem)
						),
						isPending:
							dialog.mode === "delete" && deleters[dialog.kind].isPending,
						mode: dialog.mode,
					}
				: null,
		menu:
			menu && menuItem
				? {
						archived: !isActive(menuItem),
						note: blockedReason(data, menu),
						title: menuItem.label,
					}
				: null,
		onDialogConfirm: async () => {
			if (!(dialog && dialogItem)) {
				return;
			}
			const target = { id: dialog.id, label: dialogItem.label };
			if (dialog.mode === "in-use") {
				setDialog(null);
				quietly(() => archivers[dialog.kind].mutateAsync(target));
				return;
			}
			if (deleters[dialog.kind].isPending) {
				return;
			}
			try {
				await deleters[dialog.kind].mutateAsync(target);
				setDialog(null);
				// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation shows its own failure feedback.
			} catch {}
		},
		onDialogOpenChange: (open: boolean) => {
			if (!open) {
				setDialog(null);
			}
		},
		onMenuArchive: () => {
			const target = takeMenu();
			if (target) {
				quietly(() => archivers[target.kind].mutateAsync(target));
			}
		},
		onMenuDelete: () => {
			const target = takeMenu();
			if (target && menuItem) {
				setDialog({
					id: target.id,
					kind: target.kind,
					mode: menuItem.isReferenced ? "in-use" : "delete",
				});
			}
		},
		onMenuEdit: () => {
			const target = takeMenu();
			if (target) {
				onEdit(target);
			}
		},
		onMenuOpenChange: (open: boolean) => {
			if (!open) {
				setMenu(null);
			}
		},
		onMenuRestore: () => {
			const target = takeMenu();
			if (target) {
				quietly(() => restorers[target.kind].mutateAsync(target));
			}
		},
		onOpen: (kind: MasterKind, id: string) => () => setMenu({ id, kind }),
	};
}
