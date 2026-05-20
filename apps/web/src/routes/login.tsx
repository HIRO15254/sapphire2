import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/features/auth/components/login-screen";
import { authClient } from "@/lib/auth-client";
import { PreviewAutoLogin } from "@/shared/components/preview-auto-login";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<PreviewAutoLogin />
			<LoginScreen />
		</>
	);
}
