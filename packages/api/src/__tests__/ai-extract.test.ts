import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("aiExtract router", () => {
	it("appRouter has aiExtract namespace", () => {
		expect(appRouter.aiExtract).toBeDefined();
	});

	it("has extractTournamentData procedure", () => {
		expect(appRouter.aiExtract.extractTournamentData).toBeDefined();
	});

	it("has extractTablePlayers procedure", () => {
		expect(appRouter.aiExtract.extractTablePlayers).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.aiExtract).sort()).toEqual(
			["extractTablePlayers", "extractTournamentData"].sort()
		);
	});

	it("both procedures are protected mutations", () => {
		expectProtected(appRouter.aiExtract.extractTournamentData);
		expectType(appRouter.aiExtract.extractTournamentData, "mutation");
		expectProtected(appRouter.aiExtract.extractTablePlayers);
		expectType(appRouter.aiExtract.extractTablePlayers, "mutation");
	});
});

describe("aiExtract.extractTournamentData input validation", () => {
	const urlSource = { kind: "url", url: "https://example.com/tournament" };
	const imageSource = {
		kind: "image",
		data: "base64data",
		mediaType: "image/png",
	};

	it("accepts 1 url source", () => {
		expectAccepts(appRouter.aiExtract.extractTournamentData, {
			sources: [urlSource],
		});
	});

	it("accepts up to 5 sources (upper boundary)", () => {
		expectAccepts(appRouter.aiExtract.extractTournamentData, {
			sources: [urlSource, urlSource, urlSource, urlSource, urlSource],
		});
	});

	it("rejects more than 5 sources", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [
				urlSource,
				urlSource,
				urlSource,
				urlSource,
				urlSource,
				urlSource,
			],
		});
	});

	it("rejects empty sources array", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [],
		});
	});

	it("accepts mixed url and image sources", () => {
		expectAccepts(appRouter.aiExtract.extractTournamentData, {
			sources: [urlSource, imageSource],
		});
	});

	it("rejects url source with malformed URL", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ kind: "url", url: "not a url" }],
		});
	});

	it("rejects image source with unknown media type", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ kind: "image", data: "d", mediaType: "image/bmp" }],
		});
	});

	it("accepts every allowed image media type", () => {
		for (const mediaType of [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
		]) {
			expectAccepts(appRouter.aiExtract.extractTournamentData, {
				sources: [{ kind: "image", data: "d", mediaType }],
			});
		}
	});

	it("rejects source missing discriminator", () => {
		expectRejects(appRouter.aiExtract.extractTournamentData, {
			sources: [{ url: "https://example.com" }],
		});
	});
});

describe("aiExtract.extractTablePlayers input validation", () => {
	const validImage = {
		kind: "image",
		data: "d",
		mediaType: "image/jpeg",
	};

	it("accepts dmm_waitinglist with exactly 1 source", () => {
		expectAccepts(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [validImage],
		});
	});

	it("rejects an unknown sourceApp", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "some_other_app",
			sources: [validImage],
		});
	});

	it("rejects 0 sources", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [],
		});
	});

	it("rejects more than 1 source (length constraint)", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
			sources: [validImage, validImage],
		});
	});

	it("rejects missing sources", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sourceApp: "dmm_waitinglist",
		});
	});

	it("rejects missing sourceApp", () => {
		expectRejects(appRouter.aiExtract.extractTablePlayers, {
			sources: [validImage],
		});
	});
});
