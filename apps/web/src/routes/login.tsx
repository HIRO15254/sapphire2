import { env } from "@sapphire2/env/web";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/pages/login-page";
import { resolveMcpAuthorizeRedirect } from "@/features/auth/utils/oauth-redirect";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	beforeLoad: async ({ location }) => {
		const session = await authClient.getSession();
		if (session.data) {
			// An MCP OAuth authorize flow parked its query here while the user
			// signed in — resume it on the server instead of entering the app.
			const authorizeUrl = resolveMcpAuthorizeRedirect(
				env.VITE_SERVER_URL,
				location.search
			);
			if (authorizeUrl) {
				throw redirect({ href: authorizeUrl });
			}
			throw redirect({ to: "/statistics" });
		}
	},
	component: LoginPage,
});
