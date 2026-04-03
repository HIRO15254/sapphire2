import { useForm } from "@tanstack/react-form";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { DiscordIcon } from "./icons/discord";
import { GoogleIcon } from "./icons/google";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
			newPassword: "",
			confirmPassword: "",
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
					newPassword: z
						.string()
						.min(8, "Password must be at least 8 characters"),
					confirmPassword: z
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
			onOpenChange={onOpenChange}
			open={open}
			title="Set Password"
		>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="newPassword">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>New Password</Label>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="password"
								value={field.state.value}
							/>
							{field.state.meta.errors.map((error) => (
								<p className="text-red-500 text-sm" key={error?.message}>
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>Confirm Password</Label>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="password"
								value={field.state.value}
							/>
							{field.state.meta.errors.map((error) => (
								<p className="text-red-500 text-sm" key={error?.message}>
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Subscribe>
					{(state) => (
						<Button
							className="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{state.isSubmitting ? "Setting..." : "Set Password"}
						</Button>
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
				{hasCredential ? (
					<span className="text-muted-foreground text-xs">Linked</span>
				) : (
					<Button
						onClick={() => setSetPasswordOpen(true)}
						size="sm"
						variant="outline"
					>
						Set Password
					</Button>
				)}
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

			<SetPasswordDialog
				onOpenChange={setSetPasswordOpen}
				onSuccess={fetchAccounts}
				open={setPasswordOpen}
			/>
		</div>
	);
}
