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

interface UsePasskeysResult {
	deleteTarget: PasskeyEntry | null;
	error: string | null;
	isAddOpen: boolean;
	isDeletePending: boolean;
	isPasskeySupported: boolean;
	isRefreshPending: boolean;
	isRenamePending: boolean;
	loading: boolean;
	menuTarget: PasskeyEntry | null;
	onAddOpenChange: (open: boolean) => void;
	onDeletePasskey: () => Promise<void>;
	onDeleteTargetChange: (entry: PasskeyEntry | null) => void;
	onMenuTargetChange: (entry: PasskeyEntry | null) => void;
	onRemoveFromMenu: () => void;
	onRenameFromMenu: () => void;
	onRenamePasskey: (name: string) => Promise<void>;
	onRenameTargetChange: (entry: PasskeyEntry | null) => void;
	passkeys: PasskeyEntry[];
	refreshPasskeys: () => Promise<void>;
	renameTarget: PasskeyEntry | null;
	totalPasskeys: number;
}

export function usePasskeys(): UsePasskeysResult {
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
		onDeletePasskey,
		onDeleteTargetChange: setDeleteTarget,
		onMenuTargetChange: setMenuTarget,
		onRemoveFromMenu: () => {
			setDeleteTarget(menuTarget);
			setMenuTarget(null);
		},
		onRenameFromMenu: () => {
			setRenameTarget(menuTarget);
			setMenuTarget(null);
		},
		onRenamePasskey,
		onRenameTargetChange: setRenameTarget,
		passkeys,
		refreshPasskeys,
		renameTarget,
		totalPasskeys: passkeys.length,
	};
}
