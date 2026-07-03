import { describe, expect, it } from "vitest";
import { isGoogleMapsUrl } from "../maps-url";

describe("isGoogleMapsUrl", () => {
	it("accepts full google.com maps URLs", () => {
		expect(isGoogleMapsUrl("https://www.google.com/maps/@35.6,139.7,17z")).toBe(
			true
		);
	});

	it("accepts country TLDs and maps subdomain", () => {
		expect(isGoogleMapsUrl("https://maps.google.com/?q=35.6,139.7")).toBe(true);
		expect(isGoogleMapsUrl("https://www.google.co.jp/maps")).toBe(true);
	});

	it("accepts short links", () => {
		expect(isGoogleMapsUrl("https://maps.app.goo.gl/abcd")).toBe(true);
		expect(isGoogleMapsUrl("https://goo.gl/maps/abcd")).toBe(true);
	});

	it("rejects non-google hosts", () => {
		expect(isGoogleMapsUrl("https://example.com/maps")).toBe(false);
	});

	it("rejects lookalike hosts", () => {
		expect(isGoogleMapsUrl("https://google.com.evil.com/maps")).toBe(false);
		expect(isGoogleMapsUrl("https://evil-google.com")).toBe(false);
	});

	it("rejects non-URL strings", () => {
		expect(isGoogleMapsUrl("not a url")).toBe(false);
		expect(isGoogleMapsUrl("")).toBe(false);
	});
});
