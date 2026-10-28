import { AuthFormLayout } from "@/features/auth/pages/login-page/auth-form-layout";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import Loader from "@/shared/components/loader";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Spinner } from "@/shared/components/ui/spinner";
import { useSignUp } from "./use-sign-up";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const {
		emailError,
		errorMessage,
		form,
		isBusy,
		isPending,
		isSubmitting,
		onSignUpWithDiscord,
		onSignUpWithGoogle,
	} = useSignUp();

	if (isPending) {
		return <Loader />;
	}

	return (
		<AuthFormLayout
			alert={
				errorMessage ? (
					<Alert variant="destructive">
						<AlertTitle>Couldn't create your account</AlertTitle>
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				) : null
			}
			description="Track sessions, stats and balances in one place."
			isBusy={isBusy}
			onSwitchMode={onSwitchToSignIn}
			providers={
				<>
					<Button
						className="w-full"
						disabled={isBusy}
						onClick={onSignUpWithGoogle}
						size="xl"
						type="button"
						variant="outline"
					>
						<GoogleIcon className="size-4" />
						Sign up with Google
					</Button>
					<Button
						className="w-full"
						disabled={isBusy}
						onClick={onSignUpWithDiscord}
						size="xl"
						type="button"
						variant="outline"
					>
						<DiscordIcon className="size-4" />
						Sign up with Discord
					</Button>
				</>
			}
			switchActionLabel="Sign in"
			switchPrompt="Already have an account?"
			title="Create your account"
		>
			<form
				className="contents"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-col gap-4">
					<form.Field name="name">
						{(field) => (
							<Field
								error={field.state.meta.errors[0]?.message}
								htmlFor={field.name}
								label="Name"
							>
								<Input
									autoComplete="name"
									disabled={isBusy}
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									size="xl"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="email">
						{(field) => (
							<Field
								error={
									field.state.meta.errors[0]?.message ??
									emailError(field.state.value)
								}
								htmlFor={field.name}
								label="Email"
							>
								<Input
									autoComplete="email"
									disabled={isBusy}
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									size="xl"
									type="email"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="password">
						{(field) => (
							<Field
								description="At least 8 characters."
								error={field.state.meta.errors[0]?.message}
								htmlFor={field.name}
								label="Password"
							>
								<Input
									autoComplete="new-password"
									disabled={isBusy}
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									size="xl"
									type="password"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
				</div>
				<Button className="w-full" disabled={isBusy} size="xl" type="submit">
					{isSubmitting ? (
						<>
							<Spinner />
							Creating account
						</>
					) : (
						"Create account"
					)}
				</Button>
			</form>
		</AuthFormLayout>
	);
}
