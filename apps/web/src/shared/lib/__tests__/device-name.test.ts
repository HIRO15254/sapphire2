import { afterEach, describe, expect, it } from "vitest";
import {
	describeCurrentDevice,
	describeDevice,
	UNKNOWN_DEVICE_NAME,
} from "@/shared/lib/device-name";

const USER_AGENTS = {
	chromeMac:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
	safariMac:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
	safariIphone:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
	safariIpad:
		"Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
	chromeIos:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/133.0.0.0 Mobile/15E148 Safari/604.1",
	firefoxWindows:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
	firefoxIos:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/134.0 Mobile/15E148 Safari/605.1.15",
	edgeWindows:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0",
	operaWindows:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 OPR/118.0.0.0",
	chromeAndroid:
		"Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
	samsungAndroid:
		"Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
	chromeos:
		"Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
	firefoxLinux:
		"Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
};

describe("describeDevice", () => {
	it.each([
		["chromeMac", USER_AGENTS.chromeMac, "Chrome on macOS"],
		["safariMac", USER_AGENTS.safariMac, "Safari on macOS"],
		["safariIphone", USER_AGENTS.safariIphone, "Safari on iPhone"],
		["safariIpad", USER_AGENTS.safariIpad, "Safari on iPad"],
		["chromeIos", USER_AGENTS.chromeIos, "Chrome on iPhone"],
		["firefoxWindows", USER_AGENTS.firefoxWindows, "Firefox on Windows"],
		["firefoxIos", USER_AGENTS.firefoxIos, "Firefox on iPhone"],
		["chromeAndroid", USER_AGENTS.chromeAndroid, "Chrome on Android"],
		["chromeos", USER_AGENTS.chromeos, "Chrome on ChromeOS"],
		["firefoxLinux", USER_AGENTS.firefoxLinux, "Firefox on Linux"],
	])("labels %s as its browser and platform", (_name, userAgent, expected) => {
		expect(describeDevice({ userAgent })).toBe(expected);
	});

	it("picks Edge over the Chrome token it also carries", () => {
		expect(describeDevice({ userAgent: USER_AGENTS.edgeWindows })).toBe(
			"Edge on Windows"
		);
	});

	it("picks Opera over the Chrome token it also carries", () => {
		expect(describeDevice({ userAgent: USER_AGENTS.operaWindows })).toBe(
			"Opera on Windows"
		);
	});

	it("picks Samsung Internet over the Chrome token it also carries", () => {
		expect(describeDevice({ userAgent: USER_AGENTS.samsungAndroid })).toBe(
			"Samsung Internet on Android"
		);
	});

	it("prefers Android over the Linux token it also carries", () => {
		expect(describeDevice({ userAgent: USER_AGENTS.chromeAndroid })).toContain(
			"Android"
		);
	});

	it("prefers ChromeOS over the X11 token it also carries", () => {
		expect(describeDevice({ userAgent: USER_AGENTS.chromeos })).toContain(
			"ChromeOS"
		);
	});

	it("falls back to the platform hint when the agent names no platform", () => {
		expect(
			describeDevice({
				platformHint: "Windows",
				userAgent: "Chrome/133.0.0.0",
			})
		).toBe("Chrome on Windows");
	});

	it("ignores the platform hint when the agent already names a platform", () => {
		expect(
			describeDevice({
				platformHint: "Windows",
				userAgent: USER_AGENTS.chromeMac,
			})
		).toBe("Chrome on macOS");
	});

	it("ignores a blank platform hint", () => {
		expect(
			describeDevice({ platformHint: "   ", userAgent: "Chrome/133.0.0.0" })
		).toBe("Chrome");
	});

	it("reports the browser alone when the platform is unknown", () => {
		expect(describeDevice({ userAgent: "Firefox/134.0" })).toBe("Firefox");
	});

	it("reports the platform alone when the browser is unknown", () => {
		expect(describeDevice({ userAgent: "SomeBot (Windows NT 10.0)" })).toBe(
			"Windows"
		);
	});

	it("falls back to a vague-but-true label on an unrecognizable agent", () => {
		expect(describeDevice({ userAgent: "curl/8.7.1" })).toBe(
			UNKNOWN_DEVICE_NAME
		);
	});

	it("falls back on an empty agent", () => {
		expect(describeDevice({ userAgent: "" })).toBe(UNKNOWN_DEVICE_NAME);
	});
});

describe("describeCurrentDevice", () => {
	const originalNavigator = Object.getOwnPropertyDescriptor(
		globalThis,
		"navigator"
	);

	afterEach(() => {
		if (originalNavigator) {
			Object.defineProperty(globalThis, "navigator", originalNavigator);
		} else {
			Reflect.deleteProperty(globalThis, "navigator");
		}
	});

	function setNavigator(value: unknown): void {
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value,
			writable: true,
		});
	}

	it("reads the live user agent", () => {
		setNavigator({ userAgent: USER_AGENTS.chromeMac });
		expect(describeCurrentDevice()).toBe("Chrome on macOS");
	});

	it("passes userAgentData.platform through as the hint", () => {
		setNavigator({
			userAgent: "Chrome/133.0.0.0",
			userAgentData: { platform: "Windows" },
		});
		expect(describeCurrentDevice()).toBe("Chrome on Windows");
	});

	it("survives a navigator with no userAgent", () => {
		setNavigator({});
		expect(describeCurrentDevice()).toBe(UNKNOWN_DEVICE_NAME);
	});

	it("survives no navigator at all", () => {
		Reflect.deleteProperty(globalThis, "navigator");
		expect(describeCurrentDevice()).toBe(UNKNOWN_DEVICE_NAME);
	});
});
