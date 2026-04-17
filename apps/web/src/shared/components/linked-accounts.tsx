import { useForm } from "@tanstack/react-form";
import { IconLink, IconUnlink } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { DiscordIcon } from "./icons/discord";
import { GoogleIcon } from "./icons/google";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { DialogActionRow } from "./ui/dialog-action-row";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { ResponsiveDialog } from "./ui/responsive-dialog";

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

function SetPasswordDialog({
	onOpenChange,
	onSuccess,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
}) {
	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			newPassword: "",
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.$fetch("/set-password", {
				method: "POST",
				body: { newPassword: value.newPassword },
			});

			if (error) {
				toast.error(
					(error as { message?: string }).message || "Failed to set password"
				);
				return;
			}

			toast.success("Password set successfully");
			onSuccess();
			onOpenChange(false);
		},
		validators: {
			onSubmit: z
				.object({
					confirmPassword: z
						.string()
						.min(8, "Password must be at least 8 characters"),
					newPassword: z
						.string()
						.min(8, "Password must be at least 8 characters"),
				})
				.refine((data) => data.newPassword === data.confirmPassword, {
					message: "Passwords do not match",
					path: ["confirmPassword"],
				}),
		},
	});

	return (
		<ResponsiveDialog
			description="Create an email and password login in addition to any linked social accounts."
			onOpenChange={onOpenChange}
			open={open}
			title="Set Password"
		>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="newPassword">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="New Password"
							required
						>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								type="password"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Confirm Password"
							required
						>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								type="password"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Subscribe>
					{(state) => (
						<DialogActionRow>
							<Button
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={!state.canSubmit || state.isSubmitting}
								type="submit"
							>
								{state.isSubmitting ? "Setting..." : "Set Password"}
							</Button>
						</DialogActionRow>
					)}
				</form.Subscribe>
			</form>
		</ResponsiveDialog>
	);
}

export function LinkedAccounts() {
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [setPasswordOpen, setSetPasswordOpen] = useState(false);

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

	const linkedProviderIds = new Set(
		accounts.map((account) => account.providerId)
	);
	const hasCredential = accounts.some(
		(account) => account.providerId === "credential"
	);
	const totalLinked = accounts.length;

	return (
		<div className="space-y-3">
			<ManagementList>
				<ManagementListItem
					actions={
						hasCredential ? undefined : (
							<Button
								onClick={() => setSetPasswordOpen(true)}
								size="sm"
								variant="outline"
							>
								Set Password
							</Button>
						)
					}
					title={
						<span className="flex items-center gap-2">
							Email / Password
							{hasCredential ? (
								<Badge className="border-green-500 text-green-600" variant="outline">
									Linked
								</Badge>
							) : null}
						</span>
					}
				/>

				{PROVIDERS.map((provider) => {
					const isLinked = linkedProviderIds.has(provider.id);
					const canUnlink = isLinked && totalLinked > 1;

					return (
						<ManagementListItem
							actions={
								isLinked ? (
									<Button
										disabled={!canUnlink}
										onClick={() => handleUnlink(provider.id)}
										size="sm"
										variant="outline"
									>
										<IconUnlink />
										Unlink
									</Button>
								) : (
									<Button
										onClick={() => handleLink(provider.id)}
										size="sm"
										variant="outline"
									>
										<IconLink />
										Link
									</Button>
								)
							}
							key={provider.id}
							leading={provider.icon}
							title={
								<span className="flex items-center gap-2">
									{provider.label}
									<Badge
										className={isLinked ? "border-green-500 text-green-600" : ""}
										variant="outline"
									>
										{isLinked ? "Linked" : "Not linked"}
									</Badge>
								</span>
							}
						/>
					);
				})}
			</ManagementList>

			{totalLinked <= 1 ? (
				<p className="text-muted-foreground text-xs">
					You must have at least one linked login method.
				</p>
			) : null}

			<SetPasswordDialog
				onOpenChange={setSetPasswordOpen}
				onSuccess={fetchAccounts}
				open={setPasswordOpen}
			/>
		</div>
	);
}
