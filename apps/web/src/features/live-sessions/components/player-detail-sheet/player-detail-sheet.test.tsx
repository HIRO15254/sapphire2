import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlayerDetailSheet } from "./player-detail-sheet";

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
		title: ReactNode;
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

vi.mock("@/shared/components/ui/badge", () => ({
	Badge: ({ children }: { children: ReactNode }) => (
		<span data-testid="badge">{children}</span>
	),
}));

describe("PlayerDetailSheet", () => {
	it("shows a Temp badge when isTemporary is true", () => {
		render(
			<PlayerDetailSheet
				availableTags={[]}
				isSaving={false}
				isTemporary
				onOpenChange={vi.fn()}
				onRemove={vi.fn()}
				onSave={vi.fn()}
				open
				player={{
					id: "p1",
					memo: null,
					name: "Anonymous",
					tags: [],
				}}
			/>
		);

		expect(screen.getByTestId("badge")).toHaveTextContent("Temp");
	});

	it("does not show the badge for regular players", () => {
		render(
			<PlayerDetailSheet
				availableTags={[]}
				isSaving={false}
				onOpenChange={vi.fn()}
				onRemove={vi.fn()}
				onSave={vi.fn()}
				open
				player={{ id: "p1", memo: null, name: "Alice", tags: [] }}
			/>
		);

		expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
	});

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
			name: "Alice",
			tagIds: ["vip", "reg"],
		});
	});
});
