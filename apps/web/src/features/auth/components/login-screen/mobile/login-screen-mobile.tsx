import type { CSSProperties } from "react";
import { BrandMark, Wordmark } from "@/shared/components/brand";
import { DiscordIcon } from "@/shared/components/icons/discord";
import { GoogleIcon } from "@/shared/components/icons/google";
import type { LoginScreenViewProps } from "../use-login-screen";

const labelRow: CSSProperties = {
	alignItems: "center",
	color: "var(--foreground)",
	display: "flex",
	fontSize: "var(--text-sm)",
	fontWeight: 500,
	justifyContent: "space-between",
	width: "100%",
};

const inputBase: CSSProperties = {
	background: "var(--card)",
	border: "1px solid var(--input)",
	borderRadius: 10,
	boxSizing: "border-box",
	color: "var(--foreground)",
	fontFamily: "var(--font-sans)",
	fontSize: "var(--text-md)",
	height: "var(--input-h-mb)",
	padding: "0 14px",
	width: "100%",
};

const errorStyle: CSSProperties = {
	color: "var(--destructive)",
	fontSize: "var(--text-xs)",
};

const primaryBtn: CSSProperties = {
	alignItems: "center",
	background: "var(--primary)",
	border: "none",
	borderRadius: 10,
	color: "var(--primary-foreground)",
	cursor: "pointer",
	display: "flex",
	fontFamily: "var(--font-sans)",
	fontSize: "var(--text-md)",
	fontWeight: 600,
	height: "var(--btn-h-mb)",
	justifyContent: "center",
	width: "100%",
};

const oauthBtn: CSSProperties = {
	alignItems: "center",
	background: "var(--secondary)",
	border: "1px solid var(--border)",
	borderRadius: 10,
	color: "var(--secondary-foreground)",
	cursor: "pointer",
	display: "inline-flex",
	fontFamily: "var(--font-sans)",
	fontSize: "var(--text-sm)",
	fontWeight: 500,
	gap: 9,
	height: "var(--btn-h-mb)",
	justifyContent: "center",
	whiteSpace: "nowrap",
	width: "100%",
};

const link: CSSProperties = {
	color: "var(--primary)",
	fontWeight: 500,
	textDecoration: "none",
};

const dividerRow: CSSProperties = {
	alignItems: "center",
	color: "var(--muted-foreground)",
	display: "flex",
	fontSize: "var(--text-2xs)",
	fontWeight: 500,
	gap: 10,
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

export function LoginScreenMobile({
	form,
	mode,
	onSignInWithDiscord,
	onSignInWithGoogle,
	onSwitchToSignIn,
	onSwitchToSignUp,
}: LoginScreenViewProps) {
	const isSignIn = mode === "signin";
	const heading = isSignIn ? "Sign in" : "Create your account";
	const oauthVerb = isSignIn ? "Continue" : "Sign up";
	const ctaLabel = isSignIn ? "Sign in" : "Create account";

	return (
		<div
			style={{
				background: "var(--background)",
				color: "var(--foreground)",
				display: "flex",
				flexDirection: "column",
				fontFamily: "var(--font-sans)",
				minHeight: "100vh",
				width: "100%",
			}}
		>
			<div
				style={{
					display: "flex",
					flex: 1,
					flexDirection: "column",
					gap: 20,
					padding: "20px 20px 28px",
				}}
			>
				<div
					style={{
						alignItems: "center",
						display: "flex",
						flexDirection: "column",
						gap: 10,
						paddingTop: 8,
					}}
				>
					<BrandMark size={40} />
					<Wordmark size={18} />
				</div>

				<h1
					style={{
						fontSize: "var(--text-lg)",
						fontWeight: 600,
						letterSpacing: "var(--tracking-tight)",
						lineHeight: "var(--leading-tight)",
						margin: 0,
						textAlign: "center",
					}}
				>
					{heading}
				</h1>

				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					<button onClick={onSignInWithGoogle} style={oauthBtn} type="button">
						<GoogleIcon height={17} width={17} /> {oauthVerb} with Google
					</button>
					<button onClick={onSignInWithDiscord} style={oauthBtn} type="button">
						<DiscordIcon height={17} width={17} /> {oauthVerb} with Discord
					</button>
				</div>

				<Divider>or with email</Divider>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					style={{ display: "flex", flexDirection: "column", gap: 14 }}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<form.Field name="email">
							{(field) => (
								<div
									style={{ display: "flex", flexDirection: "column", gap: 6 }}
								>
									<div style={labelRow}>
										<label htmlFor={field.name}>Email</label>
									</div>
									<input
										autoComplete="email"
										id={field.name}
										inputMode="email"
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
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
								<div
									style={{ display: "flex", flexDirection: "column", gap: 6 }}
								>
									<div style={labelRow}>
										<label htmlFor={field.name}>Password</label>
									</div>
									<input
										autoComplete={
											isSignIn ? "current-password" : "new-password"
										}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
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
								{!state.isSubmitting && ctaLabel}
							</button>
						)}
					</form.Subscribe>
				</form>

				{!isSignIn && (
					<p
						style={{
							color: "var(--muted-foreground)",
							fontSize: "var(--text-xs)",
							lineHeight: "var(--leading-base)",
							margin: 0,
							textAlign: "center",
						}}
					>
						By creating an account you agree to our{" "}
						<a href="/terms" style={{ ...link, fontSize: "var(--text-xs)" }}>
							Terms of Service
						</a>{" "}
						and{" "}
						<a href="/privacy" style={{ ...link, fontSize: "var(--text-xs)" }}>
							Privacy Policy
						</a>
						.
					</p>
				)}

				<div
					style={{
						color: "var(--muted-foreground)",
						fontSize: "var(--text-sm)",
						marginTop: "auto",
						textAlign: "center",
					}}
				>
					{isSignIn ? "New here? " : "Have an account? "}
					<button
						onClick={isSignIn ? onSwitchToSignUp : onSwitchToSignIn}
						style={{
							...link,
							background: "transparent",
							border: "none",
							cursor: "pointer",
							fontSize: "var(--text-sm)",
							padding: 0,
						}}
						type="button"
					>
						{isSignIn ? "Create an account" : "Sign in"}
					</button>
				</div>
			</div>
		</div>
	);
}
