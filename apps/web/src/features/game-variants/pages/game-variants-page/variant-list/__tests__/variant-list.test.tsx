import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameVariantRow } from "../../types";
import { VariantList } from "../variant-list";

function variant(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
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

describe("VariantList", () => {
	it("renders a row per variant", () => {
		render(
			<VariantList
				onArchive={vi.fn()}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onRestore={vi.fn()}
				variants={[
					variant({ id: "v1", name: "NLH" }),
					variant({ id: "v2", name: "PLO" }),
				]}
			/>
		);
		expect(screen.getByText("NLH")).toBeInTheDocument();
		expect(screen.getByText("PLO")).toBeInTheDocument();
	});

	it("renders nothing when the variants array is empty", () => {
		const { container } = render(
			<VariantList
				onArchive={vi.fn()}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onRestore={vi.fn()}
				variants={[]}
			/>
		);
		expect(
			container.querySelectorAll("[data-slot='management-list-item']")
		).toHaveLength(0);
	});

	it("calls onEdit with the variant object for the clicked row", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const target = variant({ id: "v1", name: "NLH" });
		render(
			<VariantList
				onArchive={vi.fn()}
				onDelete={vi.fn()}
				onEdit={onEdit}
				onRestore={vi.fn()}
				variants={[target]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Edit NLH" }));
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit).toHaveBeenCalledWith(target);
	});

	it("calls onArchive with the variant id for the clicked row", async () => {
		const user = userEvent.setup();
		const onArchive = vi.fn();
		render(
			<VariantList
				onArchive={onArchive}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onRestore={vi.fn()}
				variants={[variant({ id: "v1", name: "NLH" })]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Archive NLH" }));
		expect(onArchive).toHaveBeenCalledTimes(1);
		expect(onArchive).toHaveBeenCalledWith("v1");
	});

	it("calls onRestore with the variant id for the clicked archived row", async () => {
		const user = userEvent.setup();
		const onRestore = vi.fn();
		render(
			<VariantList
				onArchive={vi.fn()}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onRestore={onRestore}
				variants={[
					variant({
						id: "v1",
						name: "NLH",
						archivedAt: "2026-01-01T00:00:00.000Z",
					}),
				]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Restore NLH" }));
		expect(onRestore).toHaveBeenCalledTimes(1);
		expect(onRestore).toHaveBeenCalledWith("v1");
	});

	it("calls onDelete with the variant object for the clicked row", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		const target = variant({ id: "v1", name: "NLH" });
		render(
			<VariantList
				onArchive={vi.fn()}
				onDelete={onDelete}
				onEdit={vi.fn()}
				onRestore={vi.fn()}
				variants={[target]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Delete NLH" }));
		expect(onDelete).toHaveBeenCalledTimes(1);
		expect(onDelete).toHaveBeenCalledWith(target);
	});
});
