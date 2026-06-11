import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

function getStatusText(isLoading: boolean, isConnected: boolean) {
	if (isLoading) {
		return "Checking...";
	}
	return isConnected ? "Connected" : "Disconnected";
}

function getStatusDescription(isLoading: boolean, isConnected: boolean) {
	if (isLoading) {
		return "Checking server connectivity before you continue.";
	}
	if (isConnected) {
		return "Everything looks ready.";
	}
	return "Server connection is unavailable right now.";
}

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
		statusText: getStatusText(isLoading, isConnected),
		statusDescription: getStatusDescription(isLoading, isConnected),
	};
}
