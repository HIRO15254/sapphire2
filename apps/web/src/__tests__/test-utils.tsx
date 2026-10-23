import { QueryClient } from "@tanstack/react-query";
import { onTestFinished, vi } from "vitest";

export const OAUTH_AUTHORIZE_SEARCH =
	"?client_id=c1&response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=s1";

export function stubLocation(overrides: Partial<Location> = {}): void {
	const original = window.location;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { ...original, assign: vi.fn(), ...overrides },
	});
	onTestFinished(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: original,
		});
	});
}

export function locationAssignCalls(): unknown[][] {
	return (window.location.assign as unknown as ReturnType<typeof vi.fn>).mock
		.calls;
}

export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
				staleTime: Number.POSITIVE_INFINITY,
			},
			mutations: { retry: false },
		},
	});
}

export function stubWebAuthnSupport(supported: boolean): () => void {
	const had = "PublicKeyCredential" in window;
	const previous = (window as { PublicKeyCredential?: unknown })
		.PublicKeyCredential;
	if (supported) {
		(window as { PublicKeyCredential?: unknown }).PublicKeyCredential = {};
	} else {
		Reflect.deleteProperty(window, "PublicKeyCredential");
	}
	return () => {
		if (had) {
			(window as { PublicKeyCredential?: unknown }).PublicKeyCredential =
				previous;
		} else {
			Reflect.deleteProperty(window, "PublicKeyCredential");
		}
	};
}
