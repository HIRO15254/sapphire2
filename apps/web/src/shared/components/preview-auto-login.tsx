import { env } from "@sapphire2/env/web";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

export function PreviewAutoLogin() {
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

		authClient.signIn.email({ email, password }).then((result) => {
			if (result.data) {
				navigate({ to: "/dashboard" });
			}
		});
	}, [navigate]);

	return null;
}
