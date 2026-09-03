const STORAGE_KEY = "sapphire2:passkey-auto-register-opt-out";

export function isAutomaticPasskeyOptedOut(): boolean {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

export function setAutomaticPasskeyOptOut(optedOut: boolean): void {
	try {
		if (optedOut) {
			window.localStorage.setItem(STORAGE_KEY, "1");
		} else {
			window.localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		return;
	}
}
