import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	getTimeBounds,
	groupEventsForDisplay,
} from "@/features/live-sessions/utils/session-events-formatters";
import { SessionEventsScene } from "./session-events-scene";

const mocks = vi.hoisted(() => ({
	deleteMutate: vi.fn(async () => undefined),
	events: [] as Array<{
		eventType: string;
		id: string;
		occurredAt: string;
		payload: Record<string, unknown>;
	}>,
	updateMutate: vi.fn(async () => undefined),
}));

vi.mock("./use-session-events-scene", () => ({
	useSessionEventsScene: () => {
		const [editEvent, setEditEvent] = useState<
			(typeof mocks.events)[number] | null
		>(null);
		const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
			null
		);
		const events = mocks.events;
		const groups = groupEventsForDisplay(events);
		const timeBounds = editEvent
			? getTimeBounds(events, editEvent.id)
			: { minTime: null, maxTime: null };
		return {
			editEvent,
			setEditEvent,
			confirmingDeleteId,
			setConfirmingDeleteId,
			events,
			update: (args: unknown) => mocks.updateMutate(args),
			deleteEvent: (id: string) => mocks.deleteMutate({ id }),
			isUpdatePending: false,
			groups,
			timeBounds,
		};
	},
}));

vi.mock("@/features/sessions/components/session-form-sheet", () => ({
	SessionFormSheet: ({
		children,
		open,
	}: {
		children: ReactNode;
		open: boolean;
	}) => (open ? <div>{children}</div> : null),
}));

const ADDON_AMOUNT_LABEL = /Addon Amount/;
const COST_LABEL = /^Cost/;

describe("SessionEventsScene", () => {
	it("updates a chips add/remove event from the shared scene", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-1",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene sessionId="session-1" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Edit Chips Add/Remove"));
		await user.clear(screen.getByLabelText(ADDON_AMOUNT_LABEL));
		await user.type(screen.getByLabelText(ADDON_AMOUNT_LABEL), "7500");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-1",
					payload: expect.objectContaining({ amount: 7500 }),
				})
			);
		});
	});

	it("renders the page header heading by default", () => {
		mocks.events = [];
		render(
			<SessionEventsScene sessionId="session-3" sessionType="cash_game" />
		);
		expect(
			screen.getByRole("heading", { name: "Timeline" })
		).toBeInTheDocument();
	});

	it("hides the page header heading when embedded", () => {
		mocks.events = [];
		render(
			<SessionEventsScene
				embedded
				sessionId="session-4"
				sessionType="cash_game"
			/>
		);
		expect(
			screen.queryByRole("heading", { name: "Timeline" })
		).not.toBeInTheDocument();
	});

	it("still allows event editing when embedded", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-3",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene
				embedded
				sessionId="session-5"
				sessionType="cash_game"
			/>
		);

		await user.click(screen.getByLabelText("Edit Chips Add/Remove"));
		await user.clear(screen.getByLabelText(ADDON_AMOUNT_LABEL));
		await user.type(screen.getByLabelText(ADDON_AMOUNT_LABEL), "9000");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-3",
					payload: expect.objectContaining({ amount: 9000 }),
				})
			);
		});
	});

	it("hides per-event edit and delete affordances when read-only", () => {
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-ro",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene
				embedded
				readOnly
				sessionId="session-ro"
				sessionType="cash_game"
			/>
		);

		expect(
			screen.queryByLabelText("Edit Chips Add/Remove")
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Delete Chips Add/Remove")
		).not.toBeInTheDocument();
		expect(screen.getByText("Chips Add/Remove")).toBeInTheDocument();
	});

	it("updates a purchase chips event from the shared scene", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "purchase_chips",
				id: "event-2",
				occurredAt: "2026-04-03T12:30:00.000Z",
				payload: {
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				},
			},
		];

		render(
			<SessionEventsScene sessionId="session-2" sessionType="tournament" />
		);

		await user.click(screen.getByLabelText("Edit Purchase Chips"));
		await user.clear(screen.getByLabelText(COST_LABEL));
		await user.type(screen.getByLabelText(COST_LABEL), "200");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-2",
					payload: expect.objectContaining({
						cost: 200,
					}),
				})
			);
		});
	});

	it("shows delete confirmation when the trash button is clicked", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-4",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene sessionId="session-6" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Delete Chips Add/Remove"));

		expect(screen.getByText("Delete?")).toBeInTheDocument();
	});

	it("hides delete confirmation when the cancel button is clicked", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-5",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene sessionId="session-7" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Delete Chips Add/Remove"));
		await user.click(screen.getByLabelText("Cancel delete"));

		expect(screen.queryByText("Delete?")).not.toBeInTheDocument();
	});

	it("calls deleteEvent when the delete is confirmed", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-6",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene sessionId="session-8" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Delete Chips Add/Remove"));
		await user.click(screen.getByLabelText("Confirm delete"));

		await waitFor(() => {
			expect(mocks.deleteMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "event-6" })
			);
		});
	});
});
