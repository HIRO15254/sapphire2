export function isPasskeySupported(): boolean {
	return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

type ClientCapabilities = Record<string, boolean | undefined>;

interface CapabilityProbe {
	getClientCapabilities?: () => Promise<ClientCapabilities | undefined>;
}

export async function supportsAutomaticPasskeyRegistration(): Promise<boolean> {
	if (!isPasskeySupported()) {
		return false;
	}
	const probe = window.PublicKeyCredential as unknown as CapabilityProbe;
	if (typeof probe.getClientCapabilities !== "function") {
		return false;
	}
	try {
		const capabilities = await probe.getClientCapabilities();
		return capabilities?.conditionalCreate === true;
	} catch {
		return false;
	}
}

const CANCELLED_CEREMONY_CODES = new Set([
	"AUTH_CANCELLED",
	"ERROR_CEREMONY_ABORTED",
	"NotAllowedError",
	"AbortError",
]);

export function isCancelledCeremony(error?: unknown): boolean {
	const candidate = error as
		| { code?: unknown; name?: unknown }
		| null
		| undefined;
	return [candidate?.code, candidate?.name].some(
		(value) => typeof value === "string" && CANCELLED_CEREMONY_CODES.has(value)
	);
}
