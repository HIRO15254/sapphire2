const BROWSER_PATTERNS: { label: string; pattern: RegExp }[] = [
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

export const UNKNOWN_DEVICE_NAME = "This device";

interface DeviceHints {
	maxTouchPoints?: number;
	platformHint?: string;
	userAgent: string;
}

function matchFirst(
	value: string,
	table: { label: string; pattern: RegExp }[]
): string | undefined {
	return table.find((entry) => entry.pattern.test(value))?.label;
}

export function describeDevice({
	maxTouchPoints,
	platformHint,
	userAgent,
}: DeviceHints): string {
	const browser = matchFirst(userAgent, BROWSER_PATTERNS);
	const matched =
		matchFirst(userAgent, PLATFORM_PATTERNS) || platformHint?.trim() || "";
	const platform =
		matched === "macOS" && (maxTouchPoints ?? 0) > 1 ? "iPad" : matched;

	if (browser && platform) {
		return `${browser} on ${platform}`;
	}
	return browser || platform || UNKNOWN_DEVICE_NAME;
}

interface UserAgentData {
	platform?: string;
}

export function describeCurrentDevice(): string {
	if (typeof navigator === "undefined") {
		return UNKNOWN_DEVICE_NAME;
	}
	const userAgentData = (
		navigator as Navigator & Partial<{ userAgentData: UserAgentData }>
	).userAgentData;
	return describeDevice({
		maxTouchPoints: navigator.maxTouchPoints,
		platformHint: userAgentData?.platform,
		userAgent: navigator.userAgent ?? "",
	});
}
