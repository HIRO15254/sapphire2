import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { clearPersistedQueryCache } from "@/utils/trpc";

export function useSignOut() {
	const navigate = useNavigate();

	const onSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onError: () => {
					clearPersistedQueryCache().catch(() => undefined);
				},
				onSuccess: async () => {
					await clearPersistedQueryCache().catch(() => undefined);
					navigate({ to: "/" });
				},
			},
		});
	};

	return { onSignOut };
}
