import { IconLink, IconMail, IconUnlink } from "@tabler/icons-react";
import { SectionLoadError } from "@/features/settings/pages/settings-page/section-load-error";
import { SettingsSection } from "@/features/settings/pages/settings-page/settings-section";
import { FormSheet } from "@/shared/components/form-sheet";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";
import { Spinner } from "@/shared/components/ui/spinner";
import { useSetPasswordForm } from "@/shared/hooks/use-set-password-form";
import { SOCIAL_PROVIDERS, useLinkedAccounts } from "./use-linked-accounts";

const SET_PASSWORD_FORM_ID = "set-password-form";

const PROVIDER_ICONS = {
	google: <GoogleIcon className="size-[18px]" />,
	discord: <DiscordIcon className="size-[18px]" />,
};

function SetPasswordForm({
	formId,
	intro,
	onOpenChange,
	onSuccess,
}: {
	formId: string;
	intro: string;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}) {
	const { form } = useSetPasswordForm({ onOpenChange, onSuccess });

	return (
		<form
			className="flex flex-col gap-4 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="m-0 text-muted-foreground leading-normal">{intro}</p>

			<form.Field name="newPassword">
				{(field) => (
					<Field
						description="At least 8 characters."
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="New password"
						required
					>
						<Input
							autoComplete="new-password"
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							size="xl"
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
							autoComplete="new-password"
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							size="xl"
							type="password"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

function setPasswordIntro(email: string | null, linkedSocialLabels: string[]) {
	const subject = email ? `Sign in with ${email}` : "Sign in with your email";
	if (linkedSocialLabels.length === 0) {
		return `${subject} and a password.`;
	}
	return `${subject} and a password, alongside ${linkedSocialLabels.join(" and ")}.`;
}

export function LinkedAccounts() {
	const {
		email,
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
		note,
		onSetPasswordOpenChange,
		totalLinked,
	} = useLinkedAccounts();

	if (loading) {
		return (
			<SettingsSection heading="Sign-in methods">
				<div className="flex justify-center py-3 text-muted-foreground">
					<Spinner />
				</div>
			</SettingsSection>
		);
	}

	if (error) {
		return (
			<SettingsSection heading="Sign-in methods">
				<SectionLoadError
					isRetrying={isRefreshPending}
					message={error}
					onRetry={fetchAccounts}
				/>
			</SettingsSection>
		);
	}

	return (
		<SettingsSection heading="Sign-in methods" note={note}>
			<ItemGroup aria-label="Sign-in methods" size="xl" variant="inset">
				<Item>
					<ItemMedia>
						<IconMail aria-hidden />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Email and password</ItemTitle>
						<ItemDescription>
							{hasCredential ? (email ?? "Linked") : "Not set"}
						</ItemDescription>
					</ItemContent>
					{hasCredential ? null : (
						<ItemActions>
							<Button
								onClick={() => onSetPasswordOpenChange(true)}
								size="sm"
								type="button"
								variant="outline"
							>
								Set password
							</Button>
						</ItemActions>
					)}
				</Item>

				{SOCIAL_PROVIDERS.map((provider) => {
					const isLinked = linkedProviderIds.has(provider.id);
					return (
						<Item key={provider.id}>
							<ItemMedia>{PROVIDER_ICONS[provider.id]}</ItemMedia>
							<ItemContent>
								<ItemTitle>{provider.label}</ItemTitle>
								<ItemDescription>
									{isLinked ? "Linked" : "Not linked"}
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								{isLinked ? (
									<Button
										aria-label={`Unlink ${provider.label}`}
										disabled={totalLinked <= 1}
										onClick={() => handleUnlink(provider.id)}
										size="sm"
										type="button"
										variant="ghost"
									>
										<IconUnlink aria-hidden />
										Unlink
									</Button>
								) : (
									<Button
										aria-label={`Link ${provider.label}`}
										onClick={() => handleLink(provider.id)}
										size="sm"
										type="button"
										variant="outline"
									>
										<IconLink aria-hidden />
										Link
									</Button>
								)}
							</ItemActions>
						</Item>
					);
				})}
			</ItemGroup>

			<FormSheet
				formId={SET_PASSWORD_FORM_ID}
				onOpenChange={onSetPasswordOpenChange}
				open={isSetPasswordOpen}
				title="Set a password"
			>
				<SetPasswordForm
					formId={SET_PASSWORD_FORM_ID}
					intro={setPasswordIntro(email, linkedSocialLabels)}
					onOpenChange={onSetPasswordOpenChange}
					onSuccess={fetchAccounts}
				/>
			</FormSheet>
		</SettingsSection>
	);
}
