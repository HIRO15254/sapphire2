import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface LinkedAccount {
	accountId: string;
	id: string;
	providerId: string;
}

interface UseLinkedAccountsResult {
	accounts: LinkedAccount[];
	fetchAccounts: () => Promise<void>;
	handleLink: (provider: string) => Promise<void>;
	handleUnlink: (providerId: string) => Promise<void>;
	hasCredential: boolean;
	isSetPasswordOpen: boolean;
	linkedProviderIds: Set<string>;
	loading: boolean;
	onSetPasswordOpenChange: (open: boolean) => void;
	totalLinked: number;
}

export function useLinkedAccounts(): UseLinkedAccountsResult {
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);

	const fetchAccounts = useCallback(async () => {
		const result = await authClient.listAccounts();
		setAccounts((result.data as LinkedAccount[]) ?? []);
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchAccounts();
	}, [fetchAccounts]);

	const handleLink = async (provider: string) => {
		await authClient.linkSocial({
			provider: provider as "google" | "discord",
			callbackURL: `${window.location.origin}/settings`,
		});
	};

	const handleUnlink = async (providerId: string) => {
		const result = await authClient.unlinkAccount({ providerId });
		if (result.error) {
			toast.error(result.error.message ?? "Failed to unlink account");
			return;
		}

		toast.success("Account unlinked");
		await fetchAccounts();
	};

	const linkedProviderIds = new Set(
		accounts.map((account) => account.providerId)
	);
	const hasCredential = accounts.some(
		(account) => account.providerId === "credential"
	);
	const totalLinked = accounts.length;

	return {
		accounts,
		fetchAccounts,
		handleLink,
		handleUnlink,
		hasCredential,
		isSetPasswordOpen,
		linkedProviderIds,
		loading,
		onSetPasswordOpenChange: setIsSetPasswordOpen,
		totalLinked,
	};
}
