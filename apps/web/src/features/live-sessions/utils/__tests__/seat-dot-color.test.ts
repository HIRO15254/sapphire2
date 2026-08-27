import { describe, expect, it } from "vitest";
import {
	DEFAULT_SEAT_DOT_COLOR,
	seatDotColor,
} from "@/features/live-sessions/utils/seat-dot-color";

describe("seatDotColor", () => {
	it("falls back to the muted token for undefined tags", () => {
		expect(seatDotColor(undefined)).toBe(DEFAULT_SEAT_DOT_COLOR);
	});

	it("falls back to the muted token for null tags", () => {
		expect(seatDotColor(null)).toBe(DEFAULT_SEAT_DOT_COLOR);
	});

	it("falls back to the muted token for an empty tag list", () => {
		expect(seatDotColor([])).toBe(DEFAULT_SEAT_DOT_COLOR);
	});

	it("falls back to the muted token when the first tag has no color", () => {
		expect(seatDotColor([{ color: null }])).toBe(DEFAULT_SEAT_DOT_COLOR);
	});

	it("falls back to the muted token for an unknown color name", () => {
		expect(seatDotColor([{ color: "chartreuse" }])).toBe(
			DEFAULT_SEAT_DOT_COLOR
		);
	});

	it("maps red to the destructive token", () => {
		expect(seatDotColor([{ color: "red" }])).toBe("var(--destructive)");
	});

	it("maps orange to the warning token", () => {
		expect(seatDotColor([{ color: "orange" }])).toBe("var(--warning)");
	});

	it("maps yellow to the warning token", () => {
		expect(seatDotColor([{ color: "yellow" }])).toBe("var(--warning)");
	});

	it("maps green to the success token", () => {
		expect(seatDotColor([{ color: "green" }])).toBe("var(--success)");
	});

	it("maps blue to the info token", () => {
		expect(seatDotColor([{ color: "blue" }])).toBe("var(--info)");
	});

	it("maps purple to the primary token", () => {
		expect(seatDotColor([{ color: "purple" }])).toBe("var(--primary)");
	});

	it("maps pink to the primary token", () => {
		expect(seatDotColor([{ color: "pink" }])).toBe("var(--primary)");
	});

	it("maps gray to the muted token", () => {
		expect(seatDotColor([{ color: "gray" }])).toBe("var(--muted-foreground)");
	});

	it("uses only the first tag when several are present", () => {
		expect(seatDotColor([{ color: "green" }, { color: "red" }])).toBe(
			"var(--success)"
		);
	});
});
