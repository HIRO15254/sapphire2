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
