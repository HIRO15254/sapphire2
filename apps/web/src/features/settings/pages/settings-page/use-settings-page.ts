import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export function useSettingsPage() {
	const navigate = useNavigate();

	const onSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					navigate({ to: "/" });
				},
			},
		});
	};

	return { onSignOut };
}
