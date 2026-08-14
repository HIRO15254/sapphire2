import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { isPasskeySupported } from "@/shared/lib/webauthn";

export interface PasskeyEntry {
	backedUp?: boolean;
	createdAt: string;
	id: string;
	name?: string | null;
}

interface UsePasskeysResult {
	error: string | null;
	isAddOpen: boolean;
	isPasskeySupported: boolean;
	loading: boolean;
	onAddOpenChange: (open: boolean) => void;
	onDeletePasskey: (id: string) => Promise<void>;
	passkeys: PasskeyEntry[];
	refreshPasskeys: () => Promise<void>;
	totalPasskeys: number;
}

export function usePasskeys(): UsePasskeysResult {
	const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAddOpen, setIsAddOpen] = useState(false);

	const refreshPasskeys = useCallback(async () => {
		try {
			const result = await authClient.passkey.listUserPasskeys();
			setPasskeys((result.data as PasskeyEntry[] | null) ?? []);
			setError(null);
		} catch {
			setError("Unable to load passkeys");
			setPasskeys([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refreshPasskeys();
	}, [refreshPasskeys]);

	const onDeletePasskey = async (id: string) => {
		const result = await authClient.passkey.deletePasskey({ id });
		if (result.error) {
			toast.error(result.error.message ?? "Failed to remove passkey");
			return;
		}

		toast.success("Passkey removed");
		await refreshPasskeys();
	};

	return {
		error,
		isAddOpen,
		isPasskeySupported: isPasskeySupported(),
		loading,
		onAddOpenChange: setIsAddOpen,
		onDeletePasskey,
		passkeys,
		refreshPasskeys,
		totalPasskeys: passkeys.length,
	};
}
