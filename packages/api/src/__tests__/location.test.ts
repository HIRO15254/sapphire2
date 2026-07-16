import { afterEach, describe, expect, it, vi } from "vitest";
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

function locationCaller() {
	return appRouter.createCaller({
		session: { user: { id: "user-1" } },
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).location;
}

async function expectBadRequest(promise: Promise<unknown>): Promise<void> {
	await expect(promise).rejects.toMatchObject({ code: "BAD_REQUEST" });
}

function redirect(location: string): Response {
	return new Response(null, { status: 302, headers: { location } });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("location.resolveLink short-link redirects", () => {
	it.each([
		[
			"https://maps.app.goo.gl/abc",
			"https://evil.example/maps/@35.6812,139.7671,17z",
		],
		["https://goo.gl/maps/abc", "http://127.0.0.1:8787/admin"],
	])("rejects a redirect to %s after one manual fetch", async (url, target) => {
		const fetchMock = vi.fn().mockResolvedValue(redirect(target));
		vi.stubGlobal("fetch", fetchMock);

		await expectBadRequest(locationCaller().resolveLink({ url }));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			url,
			expect.objectContaining({ redirect: "manual" })
		);
	});

	it("accepts an allowlisted Google Maps redirect without fetching its destination", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				redirect("https://www.google.com/maps/@35.6812,139.7671,17z")
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			locationCaller().resolveLink({ url: "https://maps.app.goo.gl/abc" })
		).resolves.toEqual({ latitude: 35.6812, longitude: 139.7671 });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
	});

	it("resolves relative short-link locations and validates each hop", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(redirect("/next"))
			.mockResolvedValueOnce(
				redirect("https://maps.google.com/?q=35.6812,139.7671")
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			locationCaller().resolveLink({ url: "https://maps.app.goo.gl/abc" })
		).resolves.toEqual({ latitude: 35.6812, longitude: 139.7671 });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://maps.app.goo.gl/next",
			expect.objectContaining({ redirect: "manual" })
		);
	});
	it("rejects a short-link fetch failure", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
		vi.stubGlobal("fetch", fetchMock);

		await expectBadRequest(
			locationCaller().resolveLink({ url: "https://goo.gl/maps/abc" })
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("rejects loops, missing locations, and non-redirect responses", async () => {
		const scenarios = [
			[redirect("/next"), redirect("/maps/abc")],
			[new Response(null, { status: 302 })],
			[new Response(null, { status: 200 })],
		] as const;

		for (const responses of scenarios) {
			const fetchMock = vi
				.fn()
				.mockImplementation(() =>
					Promise.resolve(responses[fetchMock.mock.calls.length - 1])
				);
			vi.stubGlobal("fetch", fetchMock);

			await expectBadRequest(
				locationCaller().resolveLink({ url: "https://goo.gl/maps/abc" })
			);
			expect(fetchMock).toHaveBeenCalledTimes(responses.length);
			vi.unstubAllGlobals();
		}
	});

	it("stops after five short-link redirects", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			const index = Number(new URL(url).pathname.slice(1) || "0");
			return Promise.resolve(redirect(`/${index + 1}`));
		});
		vi.stubGlobal("fetch", fetchMock);

		await expectBadRequest(
			locationCaller().resolveLink({ url: "https://maps.app.goo.gl/0" })
		);

		expect(fetchMock).toHaveBeenCalledTimes(5);
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
		// `google` as a subdomain of another registrable domain.
		expect(isGoogleMapsUrl("https://google.evil.com/maps")).toBe(false);
		expect(isGoogleMapsUrl("https://google.evil.co/maps")).toBe(false);
	});

	it("accepts co / com second-level ccTLDs", () => {
		expect(isGoogleMapsUrl("https://www.google.com.au/maps")).toBe(true);
		expect(isGoogleMapsUrl("https://google.de/maps")).toBe(true);
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
