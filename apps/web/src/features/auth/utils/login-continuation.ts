import { env } from "@sapphire2/env/web";
import { resolveMcpAuthorizeRedirect } from "@/features/auth/utils/oauth-redirect";

export type SocialProvider = "discord" | "google";

const SOCIAL_ERROR_PARAM = "socialError";
const SOCIAL_ERROR_PARAMS = [SOCIAL_ERROR_PARAM, "error", "error_description"];

const PROVIDER_LABELS: Record<SocialProvider, string> = {
	discord: "Discord",
	google: "Google",
};

function searchWithoutSocialError(): URLSearchParams {
	const params = new URLSearchParams(window.location.search);
	for (const key of SOCIAL_ERROR_PARAMS) {
		params.delete(key);
	}
	return params;
}

function loginUrl(params: URLSearchParams): string {
	const query = params.toString();
	return `${window.location.origin}/login${query ? `?${query}` : ""}`;
}

export function pendingAuthorizeUrl(): string | null {
	return resolveMcpAuthorizeRedirect(
		env.VITE_SERVER_URL,
		window.location.search
	);
}

export function socialCallbackUrl(): string {
	return pendingAuthorizeUrl()
		? loginUrl(searchWithoutSocialError())
		: `${window.location.origin}/`;
}

export function socialErrorCallbackUrl(provider: SocialProvider): string {
	const params = searchWithoutSocialError();
	params.set(SOCIAL_ERROR_PARAM, provider);
	return loginUrl(params);
}

export function socialSignInErrorMessage(search: string): string | null {
	const params = new URLSearchParams(search);
	const provider = params.get(SOCIAL_ERROR_PARAM);
	if (!(provider === "google" || provider === "discord")) {
		return null;
	}
	const label = PROVIDER_LABELS[provider];
	if (params.get("error") === "account_not_linked") {
		return `This email is already registered. Sign in the way you did before, then link ${label} in Settings.`;
	}
	return `Couldn't sign in with ${label}. Try again.`;
}
