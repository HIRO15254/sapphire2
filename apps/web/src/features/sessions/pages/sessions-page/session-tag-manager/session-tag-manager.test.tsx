import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SessionTagManager } from "./session-tag-manager";

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

const mocks = vi.hoisted(() => ({
	create: vi.fn(async (_name: string) => undefined),
	delete: vi.fn(async (_id: string) => undefined),
	tags: [{ id: "tag-1", name: "Series" }],
	update: vi.fn(async (_params: { id: string; name: string }) => undefined),
}));

vi.mock("./use-session-tags", () => ({
	useSessionTags: () => ({
		create: mocks.create,
		delete: mocks.delete,
		isCreatePending: false,
		isDeletePending: false,
		isUpdatePending: false,
		tags: mocks.tags,
		update: mocks.update,
	}),
}));

describe("SessionTagManager", () => {
	it("creates a session tag through the New tag form sheet", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByRole("button", { name: "New tag" }));

		await user.type(screen.getByRole("textbox"), "Online");
		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(mocks.create).toHaveBeenCalledTimes(1);
		});
		expect(mocks.create).toHaveBeenCalledWith("Online");
	});

	it("edits and saves a session tag", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Edit tag Series"));

		const input = screen.getByRole("textbox");
		await user.clear(input);
		await user.type(input, "Weekly");
		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(mocks.update).toHaveBeenCalledWith({
				id: "tag-1",
				name: "Weekly",
			});
		});
	});

	it("confirms and deletes a session tag via the centered dialog", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Delete tag Series"));

		expect(
			screen.getByRole("heading", { name: "Delete tag?" })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mocks.delete).toHaveBeenCalledWith("tag-1");
		});
	});

	it("closes the delete dialog without deleting when Cancel is clicked", async () => {
		const user = userEvent.setup();
		mocks.delete.mockClear();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Delete tag Series"));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "Delete tag?" })
			).not.toBeInTheDocument();
		});
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("renders empty state when no tags exist", () => {
		mocks.tags.length = 0;
		try {
			render(<SessionTagManager />);
			expect(screen.getByText("No session tags yet")).toBeInTheDocument();
		} finally {
			mocks.tags.push({ id: "tag-1", name: "Series" });
		}
	});
});
