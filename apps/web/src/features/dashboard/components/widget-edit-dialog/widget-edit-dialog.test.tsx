import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { WidgetEditDialog } from "./widget-edit-dialog";

const mocks = vi.hoisted(() => ({
	getWidgetEntry: vi.fn(),
}));

vi.mock("@/features/dashboard/widgets/registry", () => ({
	getWidgetEntry: mocks.getWidgetEntry,
}));

function createDeferred() {
	let resolve!: (value: unknown) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function StubEditForm({ config, formId, onSave }: WidgetEditProps) {
	return (
		<form
			data-testid="stub-edit-form"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				onSave({ ...config, saved: true });
			}}
		>
			<input aria-label="Stub field" name="stub" />
		</form>
	);
}

describe("WidgetEditDialog", () => {
	beforeEach(() => {
		mocks.getWidgetEntry.mockReset();
	});

	it("renders the EditForm inside a FormSheet titled after the widget label", () => {
		mocks.getWidgetEntry.mockReturnValue({
			label: "Currency Balance",
			EditForm: StubEditForm,
		});

		render(
			<WidgetEditDialog
				config={{}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
				open
				type="currency_balance"
				widgetId="w1"
			/>
		);

		expect(
			screen.getAllByText("Edit Currency Balance").length
		).toBeGreaterThanOrEqual(1);
		expect(screen.getByTestId("stub-edit-form")).toHaveAttribute(
			"id",
			"widget-edit-form"
		);
		expect(screen.getByLabelText("Save")).toHaveAttribute(
			"form",
			"widget-edit-form"
		);
	});

	it("submits the edit form via the toolbar Save button, then closes", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onSave = vi.fn().mockResolvedValue(undefined);
		mocks.getWidgetEntry.mockReturnValue({
			label: "Currency Balance",
			EditForm: StubEditForm,
		});

		render(
			<WidgetEditDialog
				config={{ currencyId: "c1" }}
				onOpenChange={onOpenChange}
				onSave={onSave}
				open
				type="currency_balance"
				widgetId="w1"
			/>
		);

		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(onSave).toHaveBeenCalledTimes(1);
		});
		expect(onSave).toHaveBeenNthCalledWith(1, {
			currencyId: "c1",
			saved: true,
		});
		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledTimes(1);
		});
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("disables Save while onSave is unresolved and re-enables it after resolve", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const deferred = createDeferred();
		const onSave = vi.fn().mockReturnValue(deferred.promise);
		mocks.getWidgetEntry.mockReturnValue({
			label: "Currency Balance",
			EditForm: StubEditForm,
		});

		render(
			<WidgetEditDialog
				config={{ currencyId: "c1" }}
				onOpenChange={onOpenChange}
				onSave={onSave}
				open
				type="currency_balance"
				widgetId="w1"
			/>
		);

		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(screen.getByLabelText("Save")).toBeDisabled();
		});
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenNthCalledWith(1, {
			currencyId: "c1",
			saved: true,
		});
		// Sheet must not close before the save settles.
		expect(onOpenChange).not.toHaveBeenCalled();

		// A second click while pending must not trigger a second save.
		await user.click(screen.getByLabelText("Save"));
		expect(onSave).toHaveBeenCalledTimes(1);

		deferred.resolve(undefined);

		await waitFor(() => {
			expect(screen.getByLabelText("Save")).toBeEnabled();
		});
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("keeps the sheet open and re-enables Save when onSave rejects", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const deferred = createDeferred();
		const onSave = vi.fn().mockReturnValue(deferred.promise);
		mocks.getWidgetEntry.mockReturnValue({
			label: "Currency Balance",
			EditForm: StubEditForm,
		});

		render(
			<WidgetEditDialog
				config={{ currencyId: "c1" }}
				onOpenChange={onOpenChange}
				onSave={onSave}
				open
				type="currency_balance"
				widgetId="w1"
			/>
		);

		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(screen.getByLabelText("Save")).toBeDisabled();
		});

		deferred.reject(new Error("save failed"));

		await waitFor(() => {
			expect(screen.getByLabelText("Save")).toBeEnabled();
		});
		// The sheet stays open so the user can retry; closing on a failed
		// save would silently discard their edits.
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByTestId("stub-edit-form")).toBeInTheDocument();
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("requests close when the toolbar Cancel button is clicked", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		mocks.getWidgetEntry.mockReturnValue({
			label: "Currency Balance",
			EditForm: StubEditForm,
		});

		render(
			<WidgetEditDialog
				config={{}}
				onOpenChange={onOpenChange}
				onSave={vi.fn()}
				open
				type="currency_balance"
				widgetId="w1"
			/>
		);

		await user.click(screen.getByLabelText("Cancel"));

		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("falls back to a no-settings message when the widget has no EditForm", () => {
		mocks.getWidgetEntry.mockReturnValue({
			label: "Summary Stats",
			EditForm: undefined,
		});

		render(
			<WidgetEditDialog
				config={{}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
				open
				type="summary_stats"
				widgetId="w1"
			/>
		);

		expect(
			screen.getByText("This widget has no configurable settings.")
		).toBeInTheDocument();
	});

	it("renders nothing while closed", () => {
		mocks.getWidgetEntry.mockReturnValue({
			label: "Currency Balance",
			EditForm: StubEditForm,
		});

		render(
			<WidgetEditDialog
				config={{}}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
				open={false}
				type="currency_balance"
				widgetId="w1"
			/>
		);

		expect(screen.queryByTestId("stub-edit-form")).not.toBeInTheDocument();
	});
});
