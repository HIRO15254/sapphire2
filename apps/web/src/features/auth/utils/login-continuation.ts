import { env } from "@sapphire2/env/web";
import { resolveMcpAuthorizeRedirect } from "@/features/auth/utils/oauth-redirect";

export function pendingAuthorizeUrl(): string | null {
	return resolveMcpAuthorizeRedirect(
		env.VITE_SERVER_URL,
		window.location.search
	);
}

export function socialCallbackUrl(): string {
	return pendingAuthorizeUrl()
		? `${window.location.origin}/login${window.location.search}`
		: `${window.location.origin}/statistics`;
}
