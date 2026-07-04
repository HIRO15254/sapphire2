import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { clearPersistedQueryCache } from "@/utils/trpc";

/**
 * Shared sign-out handler for every sign-out entry point (user menu, settings).
 *
 * After Better Auth's `signOut`, the React Query cache and its persisted
 * IndexedDB store are cleared before navigating home so the previous user's
 * financial data can never leak to the next account on a shared device
 * (SA2-159). The cache is cleared on `onError` too so a failed request never
 * leaves stale data behind.
 */
export function useSignOut() {
	const navigate = useNavigate();

	const onSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					await clearPersistedQueryCache().catch(() => {
						// Clearing the cache is best-effort: a failed IndexedDB delete
						// must not block the user from being navigated away.
					});
					navigate({ to: "/" });
				},
				onError: () => {
					clearPersistedQueryCache().catch(() => {
						// Same best-effort rationale as the success path above.
					});
				},
			},
		});
	};

	return { onSignOut };
}
