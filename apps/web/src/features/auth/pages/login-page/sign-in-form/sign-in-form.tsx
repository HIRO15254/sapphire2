import { IconKey } from "@tabler/icons-react";
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
import { useSignIn } from "./use-sign-in";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const {
		errorMessage,
		form,
		isBusy,
		isPasskeySupported,
		isPending,
		isSubmitting,
		onSignInWithDiscord,
		onSignInWithGoogle,
		onSignInWithPasskey,
	} = useSignIn();

	if (isPending) {
		return <Loader />;
	}

	return (
		<AuthFormLayout
			alert={
				errorMessage ? (
					<Alert variant="destructive">
						<AlertTitle>Couldn't sign in</AlertTitle>
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				) : null
			}
			description="Your sessions, stats and balances, on any device."
			isBusy={isBusy}
			onSwitchMode={onSwitchToSignUp}
			providers={
				<>
					{isPasskeySupported ? (
						<Button
							className="w-full"
							disabled={isBusy}
							onClick={onSignInWithPasskey}
							size="xl"
							type="button"
							variant="outline"
						>
							<IconKey aria-hidden />
							Sign in with a passkey
						</Button>
					) : null}
					<Button
						className="w-full"
						disabled={isBusy}
						onClick={onSignInWithGoogle}
						size="xl"
						type="button"
						variant="outline"
					>
						<GoogleIcon className="size-4" />
						Sign in with Google
					</Button>
					<Button
						className="w-full"
						disabled={isBusy}
						onClick={onSignInWithDiscord}
						size="xl"
						type="button"
						variant="outline"
					>
						<DiscordIcon className="size-4" />
						Sign in with Discord
					</Button>
				</>
			}
			switchActionLabel="Create an account"
			switchPrompt="New to Sapphire 2?"
			title="Sign in"
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
					<form.Field name="email">
						{(field) => (
							<Field
								error={field.state.meta.errors[0]?.message}
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
								error={field.state.meta.errors[0]?.message}
								htmlFor={field.name}
								label="Password"
							>
								<Input
									autoComplete="current-password"
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
							Signing in
						</>
					) : (
						"Sign in"
					)}
				</Button>
			</form>
		</AuthFormLayout>
	);
}
