/**
 * Best-effort human label for the device a passkey is being created on, used
 * as the default passkey name so a list of them is tellable apart.
 *
 * This is a *label*, not identification: it says where the passkey was
 * created, and a synced passkey (iCloud Keychain, Google Password Manager)
 * will be usable on other devices too. The user can rename it in settings,
 * which is the real answer whenever this guess reads wrong.
 *
 * Deliberately small. User-agent sniffing has no correct answer, so the
 * failure mode is aimed at "vague but true" ("This device") rather than a
 * confidently wrong string.
 */

const BROWSER_PATTERNS: { label: string; pattern: RegExp }[] = [
	// Order matters: Edge and Opera both carry "Chrome/" in their UA, and
	// Chrome carries "Safari/". Most specific first.
	{ label: "Edge", pattern: /\b(?:Edg|EdgA|EdgiOS)\// },
	{ label: "Opera", pattern: /\b(?:OPR|OPiOS)\/|\bOpera\b/ },
	{ label: "Firefox", pattern: /\bFirefox\/|\bFxiOS\// },
	{ label: "Samsung Internet", pattern: /\bSamsungBrowser\// },
	{ label: "Chrome", pattern: /\bChrome\/|\bCriOS\// },
	{ label: "Safari", pattern: /\bSafari\// },
];

const PLATFORM_PATTERNS: { label: string; pattern: RegExp }[] = [
	{ label: "iPhone", pattern: /\biPhone\b/ },
	{ label: "iPad", pattern: /\biPad\b/ },
	{ label: "Android", pattern: /\bAndroid\b/ },
	{ label: "ChromeOS", pattern: /\bCrOS\b/ },
	{ label: "Windows", pattern: /\bWindows\b/ },
	{ label: "macOS", pattern: /\bMac OS X\b|\bMacintosh\b/ },
	{ label: "Linux", pattern: /\bLinux\b|\bX11\b/ },
];

/** Shown when nothing about the device could be identified. */
export const UNKNOWN_DEVICE_NAME = "This device";

interface DeviceHints {
	/**
	 * `navigator.userAgentData.platform` where the browser exposes it. Only
	 * consulted when the user-agent string yields no platform, since it is
	 * absent outside Chromium and coarser where it exists ("iOS" vs "iPhone").
	 */
	platformHint?: string;
	userAgent: string;
}

function matchFirst(
	value: string,
	table: { label: string; pattern: RegExp }[]
): string | undefined {
	return table.find((entry) => entry.pattern.test(value))?.label;
}

/**
 * Pure core of {@link describeCurrentDevice} — takes the browser signals
 * rather than reading globals, so every branch is directly testable.
 */
export function describeDevice({
	platformHint,
	userAgent,
}: DeviceHints): string {
	const browser = matchFirst(userAgent, BROWSER_PATTERNS);
	const platform =
		matchFirst(userAgent, PLATFORM_PATTERNS) || platformHint?.trim() || "";

	if (browser && platform) {
		return `${browser} on ${platform}`;
	}
	return browser || platform || UNKNOWN_DEVICE_NAME;
}

interface UserAgentData {
	platform?: string;
}

/** {@link describeDevice} applied to the current browser. */
export function describeCurrentDevice(): string {
	if (typeof navigator === "undefined") {
		return UNKNOWN_DEVICE_NAME;
	}
	const userAgentData = (
		navigator as Navigator & Partial<{ userAgentData: UserAgentData }>
	).userAgentData;
	return describeDevice({
		platformHint: userAgentData?.platform,
		userAgent: navigator.userAgent ?? "",
	});
}
