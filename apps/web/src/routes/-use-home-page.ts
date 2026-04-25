import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export function useHomePage() {
	const healthCheck = useQuery(trpc.healthCheck.queryOptions());
	const { data: session } = authClient.useSession();

	const isConnected = Boolean(healthCheck.data);
	const isSignedIn = Boolean(session);
	const isLoading = healthCheck.isLoading;
	const userName = session?.user.name ?? null;

	return {
		isConnected,
		isSignedIn,
		isLoading,
		userName,
	};
}
