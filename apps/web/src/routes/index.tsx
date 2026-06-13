import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The public landing page was removed — the root path only dispatches:
 * signed-in users land on the statistics page, everyone else on the login page.
 *
 * The session is read from router context (fetched once by __root's
 * beforeLoad guard) instead of calling getSession again; the guard has
 * already redirected signed-out users to /login, so the /login branch here
 * is a typed fallback for that invariant.
 */
export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		throw redirect({ to: context.session?.data ? "/statistics" : "/login" });
	},
	component: () => null,
});
