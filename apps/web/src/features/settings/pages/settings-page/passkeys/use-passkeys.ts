import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { setAutomaticPasskeyOptOut } from "@/shared/lib/passkey-opt-out";
import { isPasskeySupported } from "@/shared/lib/webauthn";

export interface PasskeyEntry {
	backedUp?: boolean;
	createdAt: Date | string;
	id: string;
	name?: string | null;
}

export function usePasskeys() {
	const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [menuTarget, setMenuTarget] = useState<PasskeyEntry | null>(null);
	const [renameTarget, setRenameTarget] = useState<PasskeyEntry | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<PasskeyEntry | null>(null);
	const [isDeletePending, setIsDeletePending] = useState(false);
	const [isRenamePending, setIsRenamePending] = useState(false);
	const [isRefreshPending, setIsRefreshPending] = useState(false);
	const latestRefresh = useRef(0);

	const refreshPasskeys = useCallback(async () => {
		latestRefresh.current += 1;
		const sequence = latestRefresh.current;
		const isStale = () => sequence !== latestRefresh.current;
		setIsRefreshPending(true);
		try {
			const result = await authClient.passkey.listUserPasskeys();
			if (isStale()) {
				return;
			}
			if (result.error) {
				setError("Couldn't load your passkeys.");
				setPasskeys([]);
				return;
			}
			setPasskeys((result.data as PasskeyEntry[] | null) ?? []);
			setError(null);
		} catch {
			if (isStale()) {
				return;
			}
			setError("Couldn't load your passkeys.");
			setPasskeys([]);
		} finally {
			if (!isStale()) {
				setLoading(false);
				setIsRefreshPending(false);
			}
		}
	}, []);

	useEffect(() => {
		refreshPasskeys();
	}, [refreshPasskeys]);

	const onDeletePasskey = async () => {
		if (!deleteTarget || isDeletePending) {
			return;
		}

		setIsDeletePending(true);
		try {
			const result = await authClient.passkey.deletePasskey({
				id: deleteTarget.id,
			});
			if (result.error) {
				toast.error("Couldn't remove the passkey", {
					description: result.error.message ?? undefined,
				});
				return;
			}

			toast.info("Passkey removed");
			setAutomaticPasskeyOptOut(true);
			setDeleteTarget(null);
			await refreshPasskeys();
		} finally {
			setIsDeletePending(false);
		}
	};

	const onRenamePasskey = async (name: string) => {
		if (!renameTarget || isRenamePending) {
			return;
		}

		setIsRenamePending(true);
		try {
			const result = await authClient.passkey.updatePasskey({
				id: renameTarget.id,
				name,
			});
			if (result.error) {
				toast.error("Couldn't rename the passkey", {
					description: result.error.message ?? undefined,
				});
				return;
			}

			setRenameTarget(null);
			await refreshPasskeys();
		} finally {
			setIsRenamePending(false);
		}
	};

	return {
		deleteTarget,
		error,
		isAddOpen,
		isDeletePending,
		isPasskeySupported: isPasskeySupported(),
		isRefreshPending,
		isRenamePending,
		loading,
		menuTarget,
		onAddOpenChange: setIsAddOpen,
		onCancelDelete: () => setDeleteTarget(null),
		onCloseMenu: () => setMenuTarget(null),
		onDeleteOpenChange: (open: boolean) => {
			if (!open) {
				setDeleteTarget(null);
			}
		},
		onDeletePasskey,
		onDeleteTargetChange: setDeleteTarget,
		onMenuOpenChange: (open: boolean) => {
			if (!open) {
				setMenuTarget(null);
			}
		},
		onMenuTargetChange: setMenuTarget,
		onOpenAdd: () => setIsAddOpen(true),
		onRemoveFromMenu: () => {
			setDeleteTarget(menuTarget);
			setMenuTarget(null);
		},
		onRenameFromMenu: () => {
			setRenameTarget(menuTarget);
			setMenuTarget(null);
		},
		onRenameOpenChange: (open: boolean) => {
			if (!open) {
				setRenameTarget(null);
			}
		},
		onRenamePasskey,
		onRenameTargetChange: setRenameTarget,
		onSelectPasskey: (entry: PasskeyEntry) => () => setMenuTarget(entry),
		passkeys,
		refreshPasskeys,
		renameTarget,
		totalPasskeys: passkeys.length,
	};
}
