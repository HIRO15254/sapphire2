import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlayerDetailSheet } from "../player-detail-sheet";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };
const REG_TAG = { color: "red", id: "reg", name: "Regular" };

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
		title,
	}: {
		children: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

vi.mock("@/shared/components/ui/rich-text-editor", () => ({
	RichTextEditor: ({
		initialContent,
		onChange,
	}: {
		initialContent?: string | null;
		onChange: (value: string) => void;
	}) => (
		<textarea
			aria-label="Memo"
			defaultValue={initialContent ?? ""}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
}));

describe("PlayerDetailSheet", () => {
	it("saves updated tag ids and memo without changing the payload shape", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();

		render(
			<PlayerDetailSheet
				availableTags={[VIP_TAG, REG_TAG]}
				isSaving={false}
				onOpenChange={vi.fn()}
				onRemove={vi.fn()}
				onSave={onSave}
				open
				player={{
					id: "player-1",
					memo: "Initial note",
					name: "Alice",
					tags: [VIP_TAG],
				}}
			/>
		);

		await user.type(screen.getByLabelText("Memo"), " updated");
		await user.click(screen.getByLabelText("Search player tags"));
		await user.click(screen.getByText("Regular"));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSave).toHaveBeenCalledWith({
			memo: "Initial note updated",
			tagIds: ["vip", "reg"],
		});
	});
});
