import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { describeCurrentDevice } from "@/shared/lib/device-name";
import { supportsAutomaticPasskeyRegistration } from "@/shared/lib/webauthn";

/**
 * Upgrade a just-completed password sign-in to a passkey, silently.
 *
 * Runs `navigator.credentials.create()` under `mediation: "conditional"`, so
 * a capable browser stores the passkey next to the password it just used with
 * no prompt at all. The server sends the account's existing credentials as
 * `excludeCredentials`, which is what makes this per-device rather than
 * per-account: a device that already holds a passkey for this account is
 * declined by the browser, while a new device gets one.
 *
 * Every failure is swallowed. The user did not ask for this, has already
 * signed in, and nothing downstream depends on it — a browser that declines
 * (no password manager entry, credential already present, user policy) must
 * not turn a successful login into an error message.
 *
 * The passkey is named after the device it was created on, since nobody is
 * present to name it; settings offers a rename when the guess reads wrong.
 *
 * @returns whether a passkey was actually stored.
 */
export async function autoRegisterPasskey(): Promise<boolean> {
	// The whole body is guarded, not just the registration: callers invoke this
	// fire-and-forget, so a rejection here would surface as an unhandled one.
	try {
		if (!(await supportsAutomaticPasskeyRegistration())) {
			return false;
		}
		const result = await authClient.passkey.addPasskey({
			name: describeCurrentDevice(),
			useAutoRegister: true,
		});
		return Boolean(result?.data) && !result?.error;
	} catch {
		return false;
	}
}

/**
 * Fire-and-forget entry point for the sign-in / sign-up success paths.
 *
 * Deliberately not awaited: the upgrade is silent and must not hold up entry
 * into the app. Both callers navigate client-side, so the promise outlives
 * the login page. Only a stored passkey is announced — a declined upgrade is
 * not something the user asked for and not something they need told.
 *
 * Callers must skip this when the success path leaves the document (the MCP
 * OAuth `location.assign` branch), which would abort the ceremony mid-flight.
 */
export function offerAutomaticPasskey(): void {
	autoRegisterPasskey().then((registered) => {
		if (registered) {
			toast.success("Passkey saved for this device");
		}
	});
}
