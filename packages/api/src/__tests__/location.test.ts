import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	extractCoordsFromMapsUrl,
	isGoogleMapsUrl,
	isShortMapsUrl,
} from "../routers/location";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("location router", () => {
	it("appRouter has location namespace", () => {
		expect(appRouter.location).toBeDefined();
	});

	it("exposes exactly search and resolveLink", () => {
		expect(Object.keys(appRouter.location).sort()).toEqual([
			"resolveLink",
			"search",
		]);
	});

	it("search and resolveLink are protected mutations", () => {
		expectProtected(appRouter.location.search);
		expectType(appRouter.location.search, "mutation");
		expectProtected(appRouter.location.resolveLink);
		expectType(appRouter.location.resolveLink, "mutation");
	});
});

describe("location.search input validation", () => {
	it("accepts a non-empty query", () => {
		expectAccepts(appRouter.location.search, { query: "casino tokyo" });
	});

	it("rejects an empty query", () => {
		expectRejects(appRouter.location.search, { query: "" });
	});

	it("accepts a 200-char query (upper boundary)", () => {
		expectAccepts(appRouter.location.search, { query: "x".repeat(200) });
	});

	it("rejects a query over 200 chars", () => {
		expectRejects(appRouter.location.search, { query: "x".repeat(201) });
	});

	it("rejects a missing query", () => {
		expectRejects(appRouter.location.search, {});
	});
});

describe("location.resolveLink input validation", () => {
	it("accepts a valid url", () => {
		expectAccepts(appRouter.location.resolveLink, {
			url: "https://maps.app.goo.gl/abc",
		});
	});

	it("rejects a malformed url", () => {
		expectRejects(appRouter.location.resolveLink, { url: "not a url" });
	});

	it("rejects a missing url", () => {
		expectRejects(appRouter.location.resolveLink, {});
	});
});

describe("isGoogleMapsUrl", () => {
	it("accepts google.com maps URLs", () => {
		expect(
			isGoogleMapsUrl("https://www.google.com/maps/place/x/@35.6,139.7,17z")
		).toBe(true);
	});

	it("accepts maps.google.com and country TLDs", () => {
		expect(isGoogleMapsUrl("https://maps.google.com/?q=35.6,139.7")).toBe(true);
		expect(
			isGoogleMapsUrl("https://www.google.co.jp/maps/@35.6,139.7,17z")
		).toBe(true);
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
		expect(isGoogleMapsUrl("https://evil-google.com/maps")).toBe(false);
	});

	it("rejects malformed urls", () => {
		expect(isGoogleMapsUrl("not a url")).toBe(false);
	});
});

describe("isShortMapsUrl", () => {
	it("detects short link hosts", () => {
		expect(isShortMapsUrl("https://maps.app.goo.gl/abcd")).toBe(true);
		expect(isShortMapsUrl("https://goo.gl/maps/abcd")).toBe(true);
	});

	it("is false for full google maps URLs", () => {
		expect(isShortMapsUrl("https://www.google.com/maps/@35.6,139.7,17z")).toBe(
			false
		);
	});
});

describe("extractCoordsFromMapsUrl", () => {
	it("prefers the place !3d!4d coordinates over the @ map center", () => {
		const url =
			"https://www.google.com/maps/place/X/@35.0,139.0,17z/data=!3d35.6812!4d139.7671";
		expect(extractCoordsFromMapsUrl(url)).toEqual({
			latitude: 35.6812,
			longitude: 139.7671,
		});
	});

	it("falls back to the @lat,lng map center", () => {
		expect(
			extractCoordsFromMapsUrl(
				"https://www.google.com/maps/@35.6812,139.7671,17z"
			)
		).toEqual({ latitude: 35.6812, longitude: 139.7671 });
	});

	it("falls back to a q= query parameter", () => {
		expect(
			extractCoordsFromMapsUrl("https://maps.google.com/?q=35.6812,139.7671")
		).toEqual({ latitude: 35.6812, longitude: 139.7671 });
	});

	it("handles negative coordinates", () => {
		expect(
			extractCoordsFromMapsUrl(
				"https://www.google.com/maps/@-33.8688,151.2093,17z"
			)
		).toEqual({ latitude: -33.8688, longitude: 151.2093 });
	});

	it("returns null when no coordinates are present", () => {
		expect(
			extractCoordsFromMapsUrl("https://www.google.com/maps/place/SomePlace")
		).toBeNull();
	});

	it("returns null when coordinates are out of range", () => {
		expect(
			extractCoordsFromMapsUrl("https://www.google.com/maps/@95.0,200.0,17z")
		).toBeNull();
	});
});
