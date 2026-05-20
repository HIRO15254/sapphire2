import { Lockup } from "@/shared/components/brand";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Separator } from "@/shared/components/ui/separator";
import type { LoginScreenViewProps } from "../use-login-screen";

function Divider({ children }: { children: string }) {
	return (
		<div className="flex items-center gap-2 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
			<Separator className="flex-1" />
			<span>{children}</span>
			<Separator className="flex-1" />
		</div>
	);
}

export function LoginScreenDesktop({
	form,
	mode,
	onSignInWithDiscord,
	onSignInWithGoogle,
	onSwitchToSignIn,
	onSwitchToSignUp,
}: LoginScreenViewProps) {
	const isSignIn = mode === "signin";

	return (
		<div className="relative grid min-h-screen w-full place-items-center bg-background">
			<div className="absolute top-5 left-6 flex items-center">
				<Lockup size={20} />
			</div>
			<div className="absolute top-5 right-6 flex items-center gap-1 text-muted-foreground text-xs">
				<span>{isSignIn ? "No account?" : "Have an account?"}</span>
				<Button
					className="h-auto p-0 font-medium no-underline hover:underline"
					onClick={isSignIn ? onSwitchToSignUp : onSwitchToSignIn}
					type="button"
					variant="link"
				>
					{isSignIn ? "Sign up" : "Sign in"}
				</Button>
			</div>

			<Card className="w-[392px] gap-4 px-7 pt-7 pb-6">
				<h1 className="m-0 font-semibold text-xl leading-tight tracking-tight">
					{isSignIn ? "Sign in to Sapphire2" : "Create your account"}
				</h1>

				<div className="grid grid-cols-2 gap-1.5">
					<Button
						onClick={onSignInWithGoogle}
						type="button"
						variant="secondary"
					>
						<GoogleIcon className="size-3.5" /> Google
					</Button>
					<Button
						onClick={onSignInWithDiscord}
						type="button"
						variant="secondary"
					>
						<DiscordIcon className="size-3.5" /> Discord
					</Button>
				</div>

				<Divider>or with email</Divider>

				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div className="flex flex-col gap-2.5">
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
										placeholder={isSignIn ? "Enter your password" : undefined}
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
					<p className="m-0 text-center text-[10px] text-muted-foreground leading-normal">
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
			</Card>

			<div className="absolute right-0 bottom-4 left-0 flex justify-center gap-4 text-muted-foreground text-xs">
				<a className="text-inherit no-underline hover:underline" href="/terms">
					Terms
				</a>
				<a
					className="text-inherit no-underline hover:underline"
					href="/privacy"
				>
					Privacy
				</a>
				<a className="text-inherit no-underline hover:underline" href="/help">
					Help
				</a>
			</div>
		</div>
	);
}
