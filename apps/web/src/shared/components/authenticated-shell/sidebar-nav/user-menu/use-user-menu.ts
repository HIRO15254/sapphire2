import { useUpdateNotesSheet } from "@/features/update-notes/components/update-notes-sheet";
import { authClient } from "@/lib/auth-client";
import { useSignOut } from "@/shared/hooks/use-sign-out";

export function useUserMenu() {
	const { data: session, isPending } = authClient.useSession();
	const updateNotesSheet = useUpdateNotesSheet();
	const { onSignOut } = useSignOut();

	return { session, isPending, updateNotesSheet, onSignOut };
}
