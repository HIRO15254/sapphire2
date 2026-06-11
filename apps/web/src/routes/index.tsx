import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

/**
 * The public landing page was removed — the root path only dispatches:
 * signed-in users land on the dashboard, everyone else on the login page.
 */
export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		throw redirect({ to: session.data ? "/dashboard" : "/login" });
	},
	component: () => null,
});
