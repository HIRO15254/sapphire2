import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { clearPersistedQueryCache } from "@/utils/trpc";

const SIGN_OUT_FAILED = "Couldn't sign out";
const SIGN_OUT_OFFLINE = "Check your connection and try again.";

export function useSignOut() {
	const navigate = useNavigate();
	const [isSignOutPending, setIsSignOutPending] = useState(false);

	const onSignOut = async () => {
		if (isSignOutPending) {
			return;
		}
		setIsSignOutPending(true);
		try {
			const { error } = await authClient.signOut();
			await clearPersistedQueryCache().catch(() => undefined);
			if (error) {
				toast.error(SIGN_OUT_FAILED, {
					description: error.message ?? undefined,
				});
				return;
			}
			navigate({ to: "/" });
		} catch {
			toast.error(SIGN_OUT_FAILED, { description: SIGN_OUT_OFFLINE });
		} finally {
			setIsSignOutPending(false);
		}
	};

	return { isSignOutPending, onSignOut };
}
