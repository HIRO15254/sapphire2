import { useRouter } from "@tanstack/react-router";

export function usePageHeader(fallbackTo?: string) {
	const router = useRouter();
	function onBack() {
		if (router.history.canGoBack()) {
			router.history.back();
		} else if (fallbackTo) {
			router.navigate({ to: fallbackTo });
		}
	}
	return { onBack };
}
