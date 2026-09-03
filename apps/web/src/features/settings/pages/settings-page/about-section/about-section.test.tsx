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
	it("renders the current version and falls back to Unknown without one", () => {
		mocks.version = "v3.2.2";
		const { rerender } = render(<AboutSection />);
		expect(screen.getByText("Version")).toBeInTheDocument();
		expect(screen.getByText("v3.2.2")).toBeInTheDocument();
		mocks.version = null;
		rerender(<AboutSection />);
		expect(screen.getByText("Unknown")).toBeInTheDocument();
		expect(screen.queryByText("v3.2.2")).not.toBeInTheDocument();
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
