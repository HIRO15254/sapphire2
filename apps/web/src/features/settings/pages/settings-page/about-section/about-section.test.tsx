import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AboutSection } from "./about-section";

const mocks = vi.hoisted(() => ({
	version: "v3.2.2" as string | null,
	onViewUpdateNotes: vi.fn(),
}));

vi.mock("./use-about-section", () => ({
	useAboutSection: () => ({
		version: mocks.version,
		onViewUpdateNotes: mocks.onViewUpdateNotes,
	}),
}));

describe("AboutSection", () => {
	it("renders the Version label and the current version", () => {
		mocks.version = "v3.2.2";
		render(<AboutSection />);

		expect(screen.getByText("Version")).toBeInTheDocument();
		expect(screen.getByText("v3.2.2")).toBeInTheDocument();
	});

	it("falls back to 'Unknown' when no version is available", () => {
		mocks.version = null;
		render(<AboutSection />);

		expect(screen.getByText("Unknown")).toBeInTheDocument();
	});

	it("renders a 'View update notes' button", () => {
		mocks.version = "v3.2.2";
		render(<AboutSection />);

		expect(
			screen.getByRole("button", { name: "View update notes" })
		).toBeInTheDocument();
	});

	it("calls onViewUpdateNotes once when the button is clicked", async () => {
		mocks.version = "v3.2.2";
		mocks.onViewUpdateNotes.mockClear();
		const user = userEvent.setup();
		render(<AboutSection />);

		await user.click(screen.getByRole("button", { name: "View update notes" }));

		expect(mocks.onViewUpdateNotes).toHaveBeenCalledTimes(1);
	});
});
