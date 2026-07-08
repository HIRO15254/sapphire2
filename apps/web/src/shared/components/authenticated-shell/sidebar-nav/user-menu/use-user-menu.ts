import { authClient } from "@/lib/auth-client";
import { useSignOut } from "@/shared/hooks/use-sign-out";

export function useUserMenu() {
	const { data: session, isPending } = authClient.useSession();
	const { onSignOut } = useSignOut();

	return { session, isPending, onSignOut };
}
