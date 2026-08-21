/**
 * WebAuthn feature detection, shared by the login page (whether to offer the
 * passkey button) and settings (whether to offer registration).
 *
 * `PublicKeyCredential` is the marker every passkey-capable browser exposes;
 * without it `authClient.signIn.passkey()` / `authClient.passkey.addPasskey()`
 * can only fail, so the affordance is hidden rather than shown-and-broken.
 */
export function isPasskeySupported(): boolean {
	return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

type ClientCapabilities = Record<string, boolean | undefined>;

interface CapabilityProbe {
	getClientCapabilities?: () => Promise<ClientCapabilities | undefined>;
}

/**
 * Whether the browser can store a passkey with `mediation: "conditional"` —
 * silently, with no prompt, alongside the password the user just signed in
 * with (the "automatic passkey upgrade" flow).
 *
 * Detecting this is mandatory, not an optimization. `mediation` is an unknown
 * member of `CredentialCreationOptions` on browsers that predate conditional
 * create, and WebIDL tells them to *ignore* it — so the same call that is
 * silent on a capable browser pops the full modal create prompt on an
 * incapable one. Upgrading blind would interrupt every password login on
 * exactly the browsers that cannot do it quietly.
 */
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
		// A capability probe that throws is not a capability.
		return false;
	}
}
