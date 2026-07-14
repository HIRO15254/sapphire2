import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { BlindStructureTable } from "./blind-structure-table";

describe("BlindStructureTable add actions", () => {
	it("does not submit a containing form and invokes each add handler once", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
		});
		const handleAddBreak = vi.fn();
		const handleAddLevel = vi.fn();

		render(
			<form onSubmit={onSubmit}>
				<BlindStructureTable
					blindLabels={{ blind1: "SB", blind2: "BB", blind3: "Straddle" }}
					handleAddBreak={handleAddBreak}
					handleAddLevel={handleAddLevel}
					handleCreateLevel={vi.fn()}
					handleDelete={vi.fn()}
					handleDragEnd={vi.fn()}
					handleUpdate={vi.fn()}
					handleUpdateGameSet={vi.fn()}
					levels={[]}
					sensors={[]}
				/>
			</form>
		);

		await user.click(screen.getByRole("button", { name: "Level" }));
		await user.click(screen.getByRole("button", { name: "Break" }));

		expect(onSubmit).toHaveBeenCalledTimes(0);
		expect(handleAddLevel).toHaveBeenCalledTimes(1);
		expect(handleAddBreak).toHaveBeenCalledTimes(1);
	});
});
