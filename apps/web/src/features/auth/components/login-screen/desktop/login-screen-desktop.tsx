import type { CSSProperties } from "react";
import { Lockup } from "@/shared/components/brand";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import type { LoginScreenViewProps } from "../use-login-screen";

const fieldWrapper: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
};

const labelRow: CSSProperties = {
	alignItems: "center",
	color: "var(--foreground)",
	display: "flex",
	fontSize: "var(--text-xs)",
	fontWeight: 500,
	justifyContent: "space-between",
};

const inputBase: CSSProperties = {
	background: "var(--card)",
	border: "1px solid var(--input)",
	borderRadius: "var(--radius-sm)",
	boxSizing: "border-box",
	color: "var(--foreground)",
	fontFamily: "var(--font-sans)",
	fontSize: "var(--text-sm)",
	height: "var(--input-h-pc)",
	padding: "0 10px",
	width: "100%",
};

const errorStyle: CSSProperties = {
	color: "var(--destructive)",
	fontSize: "var(--text-2xs)",
};

const primaryBtn: CSSProperties = {
	alignItems: "center",
	background: "var(--primary)",
	border: "none",
	borderRadius: "var(--radius-md)",
	color: "var(--primary-foreground)",
	cursor: "pointer",
	display: "flex",
	fontFamily: "var(--font-sans)",
	fontSize: "var(--text-sm)",
	fontWeight: 500,
	height: 36,
	justifyContent: "center",
	width: "100%",
};

const oauthBtn: CSSProperties = {
	alignItems: "center",
	background: "var(--secondary)",
	border: "1px solid var(--border)",
	borderRadius: "var(--radius-md)",
	color: "var(--secondary-foreground)",
	cursor: "pointer",
	display: "inline-flex",
	fontFamily: "var(--font-sans)",
	fontSize: "var(--text-sm)",
	fontWeight: 500,
	gap: 7,
	height: "var(--btn-h-pc)",
	justifyContent: "center",
	width: "100%",
};

const link: CSSProperties = {
	color: "var(--primary)",
	fontSize: "var(--text-sm)",
	fontWeight: 500,
	textDecoration: "none",
};

const dividerRow: CSSProperties = {
	alignItems: "center",
	color: "var(--muted-foreground)",
	display: "flex",
	fontSize: "var(--text-2xs)",
	fontWeight: 500,
	gap: 8,
	letterSpacing: "0.06em",
	textTransform: "uppercase",
};

const dividerLine: CSSProperties = {
	background: "var(--border)",
	flex: 1,
	height: 1,
};

function Divider({ children }: { children: string }) {
	return (
		<div style={dividerRow}>
			<span style={dividerLine} />
			<span>{children}</span>
			<span style={dividerLine} />
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
	const heading = isSignIn ? "Sign in to Sapphire2" : "Create your account";
	const switchPrompt = isSignIn ? "No account?" : "Have an account?";
	const switchLabel = isSignIn ? "Sign up" : "Sign in";
	const onSwitch = isSignIn ? onSwitchToSignUp : onSwitchToSignIn;

	return (
		<div
			style={{
				background: "var(--background)",
				display: "grid",
				minHeight: "100vh",
				placeItems: "center",
				position: "relative",
				width: "100%",
			}}
		>
			<div
				style={{
					alignItems: "center",
					display: "flex",
					left: 24,
					position: "absolute",
					top: 20,
				}}
			>
				<Lockup size={20} />
			</div>
			<div
				style={{
					color: "var(--muted-foreground)",
					fontSize: "var(--text-sm)",
					position: "absolute",
					right: 24,
					top: 20,
				}}
			>
				{switchPrompt}{" "}
				<button
					onClick={onSwitch}
					style={{
						...link,
						background: "transparent",
						border: "none",
						cursor: "pointer",
						padding: 0,
					}}
					type="button"
				>
					{switchLabel}
				</button>
			</div>

			<div
				style={{
					background: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: "var(--radius-xl)",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					padding: "28px 28px 24px",
					width: 392,
				}}
			>
				<h1
					style={{
						fontSize: "var(--text-xl)",
						fontWeight: 600,
						letterSpacing: "var(--tracking-tight)",
						lineHeight: "var(--leading-tight)",
						margin: 0,
					}}
				>
					{heading}
				</h1>

				<div
					style={{
						display: "grid",
						gap: 6,
						gridTemplateColumns: "1fr 1fr",
					}}
				>
					<button onClick={onSignInWithGoogle} style={oauthBtn} type="button">
						<GoogleIcon height={14} width={14} /> Google
					</button>
					<button onClick={onSignInWithDiscord} style={oauthBtn} type="button">
						<DiscordIcon height={14} width={14} /> Discord
					</button>
				</div>

				<Divider>or with email</Divider>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					style={{ display: "flex", flexDirection: "column", gap: 16 }}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						<form.Field name="email">
							{(field) => (
								<div style={fieldWrapper}>
									<div style={labelRow}>
										<label htmlFor={field.name}>Email</label>
									</div>
									<input
										autoComplete="email"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="you@example.com"
										style={inputBase}
										type="email"
										value={field.state.value}
									/>
									{field.state.meta.errors[0]?.message && (
										<span style={errorStyle}>
											{field.state.meta.errors[0].message}
										</span>
									)}
								</div>
							)}
						</form.Field>

						<form.Field name="password">
							{(field) => (
								<div style={fieldWrapper}>
									<div style={labelRow}>
										<label htmlFor={field.name}>Password</label>
										{!isSignIn && (
											<span
												style={{
													color: "var(--muted-foreground)",
													fontWeight: 400,
												}}
											>
												At least 8 characters
											</span>
										)}
									</div>
									<input
										autoComplete={
											isSignIn ? "current-password" : "new-password"
										}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder={isSignIn ? "Enter your password" : undefined}
										style={inputBase}
										type="password"
										value={field.state.value}
									/>
									{field.state.meta.errors[0]?.message && (
										<span style={errorStyle}>
											{field.state.meta.errors[0].message}
										</span>
									)}
								</div>
							)}
						</form.Field>
					</div>

					<form.Subscribe>
						{(state) => (
							<button
								disabled={!state.canSubmit || state.isSubmitting}
								style={{
									...primaryBtn,
									opacity:
										!state.canSubmit || state.isSubmitting ? 0.7 : undefined,
								}}
								type="submit"
							>
								{state.isSubmitting && isSignIn && "Signing in…"}
								{state.isSubmitting && !isSignIn && "Creating account…"}
								{!state.isSubmitting &&
									(isSignIn ? "Sign in" : "Create account")}
							</button>
						)}
					</form.Subscribe>
				</form>

				{!isSignIn && (
					<p
						style={{
							color: "var(--muted-foreground)",
							fontSize: "var(--text-2xs)",
							lineHeight: "var(--leading-base)",
							margin: 0,
							textAlign: "center",
						}}
					>
						By creating an account you agree to our{" "}
						<a href="/terms" style={{ ...link, fontSize: "var(--text-2xs)" }}>
							Terms of Service
						</a>{" "}
						and{" "}
						<a href="/privacy" style={{ ...link, fontSize: "var(--text-2xs)" }}>
							Privacy Policy
						</a>
						.
					</p>
				)}
			</div>

			<div
				style={{
					bottom: 16,
					color: "var(--muted-foreground)",
					display: "flex",
					fontSize: "var(--text-xs)",
					gap: 16,
					justifyContent: "center",
					left: 0,
					position: "absolute",
					right: 0,
				}}
			>
				<a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
					Terms
				</a>
				<a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
					Privacy
				</a>
				<a href="/help" style={{ color: "inherit", textDecoration: "none" }}>
					Help
				</a>
			</div>
		</div>
	);
}
