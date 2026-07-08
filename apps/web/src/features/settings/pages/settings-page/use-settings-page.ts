import { useSignOut } from "@/shared/hooks/use-sign-out";

export function useSettingsPage() {
	const { onSignOut } = useSignOut();

	return { onSignOut };
}
