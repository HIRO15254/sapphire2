import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { DiscordIcon } from "./icons/discord";
import { GoogleIcon } from "./icons/google";
import { Button } from "./ui/button";

interface LinkedAccount {
	accountId: string;
	id: string;
	providerId: string;
}

const PROVIDERS = [
	{ id: "google", label: "Google", icon: <GoogleIcon className="h-4 w-4" /> },
	{
		id: "discord",
		label: "Discord",
		icon: <DiscordIcon className="h-4 w-4" />,
	},
] as const;

export function LinkedAccounts() {
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchAccounts = useCallback(async () => {
		const result = await authClient.listAccounts();
		if (result.data) {
			setAccounts(result.data as LinkedAccount[]);
		}
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
			toast.error(result.error.message || "Failed to unlink account");
			return;
		}
		toast.success("Account unlinked");
		fetchAccounts();
	};

	if (loading) {
		return (
			<div className="text-muted-foreground text-sm">Loading accounts...</div>
		);
	}

	const linkedProviderIds = new Set(accounts.map((a) => a.providerId));
	const hasCredential = accounts.some((a) => a.providerId === "credential");
	const totalLinked = accounts.length;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between rounded-md border p-3">
				<div className="flex items-center gap-2">
					<p className="font-medium text-sm">Email / Password</p>
				</div>
				<span className="text-muted-foreground text-xs">
					{hasCredential ? "Linked" : "Not linked"}
				</span>
			</div>

			{PROVIDERS.map((provider) => {
				const isLinked = linkedProviderIds.has(provider.id);
				const canUnlink = isLinked && totalLinked > 1;

				return (
					<div
						className="flex items-center justify-between rounded-md border p-3"
						key={provider.id}
					>
						<div className="flex items-center gap-2">
							{provider.icon}
							<div>
								<p className="font-medium text-sm">{provider.label}</p>
								<p className="text-muted-foreground text-xs">
									{isLinked ? "Linked" : "Not linked"}
								</p>
							</div>
						</div>
						{isLinked ? (
							<Button
								disabled={!canUnlink}
								onClick={() => handleUnlink(provider.id)}
								size="sm"
								variant="outline"
							>
								Unlink
							</Button>
						) : (
							<Button
								onClick={() => handleLink(provider.id)}
								size="sm"
								variant="outline"
							>
								Link
							</Button>
						)}
					</div>
				);
			})}

			{totalLinked <= 1 && (
				<p className="text-muted-foreground text-xs">
					You must have at least one linked login method.
				</p>
			)}
		</div>
	);
}
