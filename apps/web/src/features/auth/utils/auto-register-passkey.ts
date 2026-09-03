import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { describeCurrentDevice } from "@/shared/lib/device-name";
import { supportsAutomaticPasskeyRegistration } from "@/shared/lib/webauthn";

export async function autoRegisterPasskey(): Promise<boolean> {
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

export function offerAutomaticPasskey(): void {
	autoRegisterPasskey().then((registered) => {
		if (registered) {
			toast.success("Passkey saved for this device");
		}
	});
}
