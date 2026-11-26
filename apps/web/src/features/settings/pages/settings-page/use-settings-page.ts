import { useSignOut } from "@/shared/hooks/use-sign-out";

export function useSettingsPage() {
	const { isSignOutPending, onSignOut } = useSignOut();

	return { isSignOutPending, onSignOut };
}
