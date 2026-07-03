import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SetRoomLocationDialog } from "./set-room-location-dialog";

const ROOM_NAME_PATTERN = /Casino X/;

function setup(
	overrides: Partial<Parameters<typeof SetRoomLocationDialog>[0]> = {}
) {
	const props = {
		onOpenChange: vi.fn(),
		onSave: vi.fn(),
		onSkip: vi.fn(),
		open: true,
		roomName: "Room 1",
		...overrides,
	};
	render(<SetRoomLocationDialog {...props} />);
	return props;
}

describe("SetRoomLocationDialog", () => {
	it("shows the room name in the body copy when open", () => {
		setup({ roomName: "Casino X" });
		expect(screen.getByText(ROOM_NAME_PATTERN)).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Save this room's location?" })
		).toBeInTheDocument();
	});

	it("renders nothing while closed", () => {
		setup({ open: false });
		expect(
			screen.queryByText("Save this room's location?")
		).not.toBeInTheDocument();
	});

	it("calls onSave when the save button is pressed", async () => {
		const user = userEvent.setup();
		const { onSave, onSkip } = setup();
		await user.click(screen.getByRole("button", { name: "Save location" }));
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSkip).not.toHaveBeenCalled();
	});

	it("calls onSkip when the not-now button is pressed", async () => {
		const user = userEvent.setup();
		const { onSave, onSkip } = setup();
		await user.click(screen.getByRole("button", { name: "Not now" }));
		expect(onSkip).toHaveBeenCalledTimes(1);
		expect(onSave).not.toHaveBeenCalled();
	});
});
