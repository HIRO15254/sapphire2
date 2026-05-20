import { BrandMark, Wordmark } from "@/shared/components/brand";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Separator } from "@/shared/components/ui/separator";
import type { LoginScreenViewProps } from "../use-login-screen";

function Divider({ children }: { children: string }) {
	return (
		<div className="flex items-center gap-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
			<Separator className="flex-1" />
			<span>{children}</span>
			<Separator className="flex-1" />
		</div>
	);
}

export function LoginScreenMobile({
	form,
	mode,
	onSignInWithDiscord,
	onSignInWithGoogle,
	onSwitchToSignIn,
	onSwitchToSignUp,
}: LoginScreenViewProps) {
	const isSignIn = mode === "signin";
	const oauthVerb = isSignIn ? "Continue" : "Sign up";

	return (
		<div className="flex min-h-screen w-full flex-col bg-background text-foreground">
			<div className="flex flex-1 flex-col gap-5 px-5 pt-7 pb-7">
				<div className="flex flex-col items-center gap-2.5 pt-2">
					<BrandMark size={40} />
					<Wordmark size={18} />
				</div>

				<h1 className="m-0 text-center font-semibold text-base leading-tight tracking-tight">
					{isSignIn ? "Sign in" : "Create your account"}
				</h1>

				<div className="flex flex-col gap-2.5">
					<Button
						onClick={onSignInWithGoogle}
						type="button"
						variant="secondary"
					>
						<GoogleIcon className="size-3.5" /> {oauthVerb} with Google
					</Button>
					<Button
						onClick={onSignInWithDiscord}
						type="button"
						variant="secondary"
					>
						<DiscordIcon className="size-3.5" /> {oauthVerb} with Discord
					</Button>
				</div>

				<Divider>or with email</Divider>

				<form
					className="flex flex-col gap-3.5"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div className="flex flex-col gap-3">
						<form.Field name="email">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="Email"
								>
									<Input
										autoComplete="email"
										id={field.name}
										inputMode="email"
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="you@example.com"
										type="email"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>

						<form.Field name="password">
							{(field) => (
								<Field
									description={isSignIn ? undefined : "At least 8 characters"}
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="Password"
								>
									<Input
										autoComplete={
											isSignIn ? "current-password" : "new-password"
										}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder={isSignIn ? "Enter password" : undefined}
										type="password"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					</div>

					<form.Subscribe>
						{(state) => (
							<Button
								className="w-full"
								disabled={!state.canSubmit || state.isSubmitting}
								size="lg"
								type="submit"
							>
								{state.isSubmitting && isSignIn && "Signing in…"}
								{state.isSubmitting && !isSignIn && "Creating account…"}
								{!state.isSubmitting &&
									(isSignIn ? "Sign in" : "Create account")}
							</Button>
						)}
					</form.Subscribe>
				</form>

				{!isSignIn && (
					<p className="m-0 text-center text-muted-foreground text-xs leading-normal">
						By creating an account you agree to our{" "}
						<a
							className="font-medium text-primary no-underline hover:underline"
							href="/terms"
						>
							Terms of Service
						</a>{" "}
						and{" "}
						<a
							className="font-medium text-primary no-underline hover:underline"
							href="/privacy"
						>
							Privacy Policy
						</a>
						.
					</p>
				)}

				<div className="mt-auto text-center text-muted-foreground text-sm">
					<span>{isSignIn ? "New here? " : "Have an account? "}</span>
					<Button
						className="h-auto p-0 font-medium no-underline hover:underline"
						onClick={isSignIn ? onSwitchToSignUp : onSwitchToSignIn}
						type="button"
						variant="link"
					>
						{isSignIn ? "Create an account" : "Sign in"}
					</Button>
				</div>
			</div>
		</div>
	);
}
