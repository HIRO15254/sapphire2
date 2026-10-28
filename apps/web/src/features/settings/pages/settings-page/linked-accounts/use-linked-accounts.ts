import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface LinkedAccount {
	accountId: string;
	id: string;
	providerId: string;
}

export type SocialProviderId = "discord" | "google";

export const SOCIAL_PROVIDERS = [
	{ id: "google", label: "Google" },
	{ id: "discord", label: "Discord" },
] as const satisfies readonly { id: SocialProviderId; label: string }[];

const LINK_CANCELED_MESSAGE = "The sign-in was canceled. Try again.";

function linkFailureMessage(providerId: SocialProviderId, reason?: string) {
	const label = providerLabel(providerId);
	switch (reason) {
		case undefined:
		case "access_denied":
			return LINK_CANCELED_MESSAGE;
		case "email_doesn't_match":
			return `Use a ${label} account with the same email as this account.`;
		case "account_already_linked_to_different_user":
			return `This ${label} account is already linked to another Sapphire 2 account.`;
		default:
			return "Try again.";
	}
}

function providerLabel(providerId: string) {
	return (
		SOCIAL_PROVIDERS.find((provider) => provider.id === providerId)?.label ??
		providerId
	);
}

function toastLinkFailure(providerId: SocialProviderId, description: string) {
	toast.error(`Couldn't link ${providerLabel(providerId)}`, {
		description,
		id: `link-error-${providerId}`,
	});
}

function onlyMethodNote(
	linkedProviderIds: ReadonlySet<string>,
	totalLinked: number
): string | null {
	if (totalLinked !== 1) {
		return null;
	}
	const only = SOCIAL_PROVIDERS.find((provider) =>
		linkedProviderIds.has(provider.id)
	);
	if (!only) {
		return null;
	}
	const other = SOCIAL_PROVIDERS.find((provider) => provider.id !== only.id);
	return `${only.label} is your only way to sign in, so it can't be unlinked. Set a password or link ${other?.label} first.`;
}

export function useLinkedAccounts() {
	const navigate = useNavigate();
	const { error: linkErrorReason, linkError } = useSearch({
		from: "/settings",
	});
	const { data: session } = authClient.useSession();
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [isRefreshPending, setIsRefreshPending] = useState(false);
	const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchAccounts = useCallback(async () => {
		setIsRefreshPending(true);
		try {
			const result = await authClient.listAccounts();
			setAccounts((result.data as LinkedAccount[]) ?? []);
			setError(null);
		} catch {
			setError("Couldn't load your sign-in methods.");
			setAccounts([]);
		} finally {
			setLoading(false);
			setIsRefreshPending(false);
		}
	}, []);

	useEffect(() => {
		fetchAccounts();
	}, [fetchAccounts]);

	useEffect(() => {
		if (!linkError) {
			return;
		}
		const timer = window.setTimeout(() => {
			toastLinkFailure(
				linkError,
				linkFailureMessage(linkError, linkErrorReason)
			);
			navigate({ to: "/settings", search: {}, replace: true });
		});
		return () => window.clearTimeout(timer);
	}, [linkError, linkErrorReason, navigate]);

	const handleLink = async (providerId: SocialProviderId) => {
		const settingsUrl = `${window.location.origin}/settings`;
		const result = await authClient.linkSocial({
			provider: providerId,
			callbackURL: settingsUrl,
			errorCallbackURL: `${settingsUrl}?linkError=${providerId}`,
		});
		if (result?.error) {
			toastLinkFailure(providerId, result.error.message || "Try again.");
		}
	};

	const handleUnlink = async (providerId: SocialProviderId) => {
		const result = await authClient.unlinkAccount({ providerId });
		if (result.error) {
			toast.error(`Couldn't unlink ${providerLabel(providerId)}`, {
				description: result.error.message ?? undefined,
			});
			return;
		}

		await fetchAccounts();
	};

	const linkedProviderIds = new Set(
		accounts.map((account) => account.providerId)
	);
	const hasCredential = linkedProviderIds.has("credential");
	const totalLinked = accounts.length;
	const linkedSocialLabels = SOCIAL_PROVIDERS.filter((provider) =>
		linkedProviderIds.has(provider.id)
	).map((provider) => provider.label);

	return {
		accounts,
		email: session?.user.email ?? null,
		error,
		fetchAccounts,
		handleLink,
		handleUnlink,
		hasCredential,
		isRefreshPending,
		isSetPasswordOpen,
		linkedProviderIds,
		linkedSocialLabels,
		loading,
		note:
			onlyMethodNote(linkedProviderIds, totalLinked) ??
			"Keep at least one way to sign in. Linking opens the provider's sign-in page.",
		onSetPasswordOpenChange: setIsSetPasswordOpen,
		totalLinked,
	};
}
