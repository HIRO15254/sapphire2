import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SeatMarker } from "../seat-marker";

describe("SeatMarker", () => {
	it("renders the empty variant as an enabled button with the seat's aria-label", () => {
		render(
			<SeatMarker
				ariaLabel="Seat 3 — empty"
				disabled={false}
				leftPct={26}
				topPct={85.8}
				variant="empty"
			/>
		);
		const seat = screen.getByRole("button", { name: "Seat 3 — empty" });
		expect(seat).toBeEnabled();
		expect(seat.style.left).toBe("26%");
		expect(seat.style.top).toBe("85.8%");
	});

	it("calls onTap exactly once when the empty variant is clicked", async () => {
		const user = userEvent.setup();
		const onTap = vi.fn();
		render(
			<SeatMarker
				ariaLabel="Seat 3 — empty"
				disabled={false}
				leftPct={26}
				onTap={onTap}
				topPct={85.8}
				variant="empty"
			/>
		);
		await user.click(screen.getByRole("button", { name: "Seat 3 — empty" }));
		expect(onTap).toHaveBeenCalledTimes(1);
	});

	it("disables the empty variant and blocks the tap when disabled is true", async () => {
		const user = userEvent.setup();
		const onTap = vi.fn();
		render(
			<SeatMarker
				ariaLabel="Seat 3 — empty"
				disabled={true}
				leftPct={26}
				onTap={onTap}
				topPct={85.8}
				variant="empty"
			/>
		);
		const seat = screen.getByRole("button", { name: "Seat 3 — empty" });
		expect(seat).toBeDisabled();
		await user.click(seat);
		expect(onTap).not.toHaveBeenCalled();
	});

	it("renders the hero variant as a non-interactive element with role img", () => {
		render(
			<SeatMarker
				ariaLabel="Seat 7 — you"
				disabled={false}
				leftPct={85.5}
				topPct={35}
				variant="hero"
			/>
		);
		const hero = screen.getByRole("img", { name: "Seat 7 — you" });
		expect(hero.tagName).not.toBe("BUTTON");
		expect(
			screen.queryByRole("button", { name: "Seat 7 — you" })
		).not.toBeInTheDocument();
	});

	it("renders the player variant as an enabled button and calls onTap once when clicked", async () => {
		const user = userEvent.setup();
		const onTap = vi.fn();
		render(
			<SeatMarker
				ariaLabel="Seat 2 — Alice"
				disabled={false}
				dotColor="var(--warning)"
				leftPct={14.5}
				onTap={onTap}
				topPct={63}
				variant="player"
			/>
		);
		const seat = screen.getByRole("button", { name: "Seat 2 — Alice" });
		await user.click(seat);
		expect(onTap).toHaveBeenCalledTimes(1);
	});

	it("sets the player variant's tint variable from dotColor when provided", () => {
		render(
			<SeatMarker
				ariaLabel="Seat 2 — Alice"
				disabled={false}
				dotColor="var(--info)"
				leftPct={14.5}
				topPct={63}
				variant="player"
			/>
		);
		const seat = screen.getByRole("button", { name: "Seat 2 — Alice" });
		expect(seat.style.getPropertyValue("--seat-dot-color")).toBe("var(--info)");
	});

	it("falls back the player variant's tint variable to muted-foreground when dotColor is omitted", () => {
		render(
			<SeatMarker
				ariaLabel="Seat 2 — Alice"
				disabled={false}
				leftPct={14.5}
				topPct={63}
				variant="player"
			/>
		);
		const seat = screen.getByRole("button", { name: "Seat 2 — Alice" });
		expect(seat.style.getPropertyValue("--seat-dot-color")).toBe(
			"var(--muted-foreground)"
		);
	});

	it("disables the player variant and blocks the tap when disabled is true", async () => {
		const user = userEvent.setup();
		const onTap = vi.fn();
		render(
			<SeatMarker
				ariaLabel="Seat 2 — Alice"
				disabled={true}
				leftPct={14.5}
				onTap={onTap}
				topPct={63}
				variant="player"
			/>
		);
		const seat = screen.getByRole("button", { name: "Seat 2 — Alice" });
		expect(seat).toBeDisabled();
		await user.click(seat);
		expect(onTap).not.toHaveBeenCalled();
	});
});
