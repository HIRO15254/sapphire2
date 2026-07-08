import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameVariantRow } from "../../types";
import { VariantRow } from "../variant-row";

const BLIND_LABEL_TEXT_RE = /SB|BB|Straddle/;

function baseVariant(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
	return {
		archivedAt: null,
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
		id: "v1",
		name: "NLH",
		sortOrder: 0,
		...overrides,
	};
}

function setup(overrides: Partial<GameVariantRow> = {}) {
	const onEdit = vi.fn();
	const onArchive = vi.fn();
	const onRestore = vi.fn();
	const onDelete = vi.fn();
	render(
		<VariantRow
			onArchive={onArchive}
			onDelete={onDelete}
			onEdit={onEdit}
			onRestore={onRestore}
			variant={baseVariant(overrides)}
		/>
	);
	return { onArchive, onDelete, onEdit, onRestore };
}

describe("VariantRow", () => {
	it("renders the variant name as a badge", () => {
		setup({ name: "PLO5" });
		expect(screen.getByText("PLO5")).toBeInTheDocument();
	});

	it("joins all three non-null blind labels with ' / '", () => {
		setup({ blindLabel1: "SB", blindLabel2: "BB", blindLabel3: "Straddle" });
		expect(screen.getByText("SB / BB / Straddle")).toBeInTheDocument();
	});

	it("joins only the non-null blind labels, skipping nulls", () => {
		setup({ blindLabel1: "Bring-in", blindLabel2: null, blindLabel3: null });
		expect(screen.getByText("Bring-in")).toBeInTheDocument();
	});

	it("renders no meta line when all blind labels are null", () => {
		setup({ blindLabel1: null, blindLabel2: null, blindLabel3: null });
		expect(screen.queryByText(BLIND_LABEL_TEXT_RE)).not.toBeInTheDocument();
	});

	it("shows an Archive action for an active variant", () => {
		setup({ name: "NLH", archivedAt: null });
		expect(
			screen.getByRole("button", { name: "Archive NLH" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Restore NLH" })
		).not.toBeInTheDocument();
	});

	it("shows a Restore action for an archived variant", () => {
		setup({ name: "NLH", archivedAt: "2026-01-01T00:00:00.000Z" });
		expect(
			screen.getByRole("button", { name: "Restore NLH" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Archive NLH" })
		).not.toBeInTheDocument();
	});

	it("calls onEdit when the edit button is clicked", async () => {
		const user = userEvent.setup();
		const { onEdit } = setup({ name: "NLH" });
		await user.click(screen.getByRole("button", { name: "Edit NLH" }));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("calls onArchive when the archive button is clicked", async () => {
		const user = userEvent.setup();
		const { onArchive } = setup({ name: "NLH", archivedAt: null });
		await user.click(screen.getByRole("button", { name: "Archive NLH" }));
		expect(onArchive).toHaveBeenCalledTimes(1);
	});

	it("calls onRestore when the restore button is clicked", async () => {
		const user = userEvent.setup();
		const { onRestore } = setup({
			name: "NLH",
			archivedAt: "2026-01-01T00:00:00.000Z",
		});
		await user.click(screen.getByRole("button", { name: "Restore NLH" }));
		expect(onRestore).toHaveBeenCalledTimes(1);
	});

	it("calls onDelete when the delete button is clicked", async () => {
		const user = userEvent.setup();
		const { onDelete } = setup({ name: "NLH" });
		await user.click(screen.getByRole("button", { name: "Delete NLH" }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});
});
