import { IconLink, IconUnlink } from "@tabler/icons-react";
import { FormSheet } from "@/shared/components/form-sheet";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useSetPasswordForm } from "@/shared/hooks/use-set-password-form";
import { useLinkedAccounts } from "./use-linked-accounts";

const SET_PASSWORD_FORM_ID = "set-password-form";

const PROVIDERS = [
	{ id: "google", label: "Google", icon: <GoogleIcon className="h-4 w-4" /> },
	{
		id: "discord",
		label: "Discord",
		icon: <DiscordIcon className="h-4 w-4" />,
	},
] as const;

function SetPasswordForm({
	formId,
	onOpenChange,
	onSuccess,
}: {
	formId: string;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}) {
	const { form } = useSetPasswordForm({ onOpenChange, onSuccess });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="text-muted-foreground text-sm">
				Create an email and password login in addition to any linked social
				accounts.
			</p>

			<form.Field name="newPassword">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="New password"
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
						label="Confirm password"
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
		</form>
	);
}

export function LinkedAccounts() {
	const {
		fetchAccounts,
		handleLink,
		error,
		handleUnlink,
		hasCredential,
		isSetPasswordOpen,
		linkedProviderIds,
		loading,
		onSetPasswordOpenChange,
		totalLinked,
	} = useLinkedAccounts();

	if (loading) {
		return (
			<div className="text-muted-foreground text-sm">Loading accounts...</div>
		);
	}

	if (error) {
		return (
			<div className="text-destructive text-sm" role="alert">
				{error}
			</div>
		);
	}
	return (
		<div className="space-y-3">
			<ManagementList>
				<ManagementListItem
					actions={
						hasCredential ? undefined : (
							<Button
								onClick={() => onSetPasswordOpenChange(true)}
								size="sm"
								variant="outline"
							>
								Set password
							</Button>
						)
					}
					className="min-h-14"
					title={
						<span className="flex items-center gap-2">
							Email / password
							{hasCredential ? (
								<Badge
									className="border-green-500 text-green-600"
									variant="outline"
								>
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
							className="min-h-14"
							key={provider.id}
							leading={provider.icon}
							title={
								<span className="flex items-center gap-2">
									{provider.label}
									<Badge
										className={
											isLinked ? "border-green-500 text-green-600" : ""
										}
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

			<FormSheet
				formId={SET_PASSWORD_FORM_ID}
				onOpenChange={onSetPasswordOpenChange}
				open={isSetPasswordOpen}
				title="Set password"
			>
				<SetPasswordForm
					formId={SET_PASSWORD_FORM_ID}
					onOpenChange={onSetPasswordOpenChange}
					onSuccess={fetchAccounts}
				/>
			</FormSheet>
		</div>
	);
}
