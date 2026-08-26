import { env } from "@sapphire2/env/web";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { pendingAuthorizeUrl } from "@/features/auth/utils/login-continuation";
import { authClient } from "@/lib/auth-client";

export function usePreviewAutoLogin(): void {
	const attempted = useRef(false);
	const navigate = useNavigate();

	useEffect(() => {
		if (attempted.current) {
			return;
		}
		if (env.VITE_PREVIEW_AUTO_LOGIN !== "true") {
			return;
		}

		const email = env.VITE_PREVIEW_LOGIN_EMAIL;
		const password = env.VITE_PREVIEW_LOGIN_PASSWORD;
		if (!(email && password)) {
			return;
		}

		attempted.current = true;

		authClient.signIn
			.email({ email, password })
			.then((result) => {
				if (!result.data) {
					return;
				}
				const authorizeUrl = pendingAuthorizeUrl();
				if (authorizeUrl) {
					window.location.assign(authorizeUrl);
					return;
				}
				navigate({ to: "/statistics" });
			})
			.catch((error) => {
				console.error("Preview auto-login failed", error);
			});
	}, [navigate]);
}
