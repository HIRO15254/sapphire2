import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubWebAuthnSupport } from "@/__tests__/test-utils";
import { Passkeys } from "./passkeys";

const mocks = vi.hoisted(() => ({
	listUserPasskeys: vi.fn(),
	deletePasskey: vi.fn(),
	updatePasskey: vi.fn(),
	addPasskey: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/shared/components/ui/drawer", () => ({
	Drawer: ({ children, open }: { children: ReactNode; open?: boolean }) =>
		open ? <div data-testid="drawer">{children}</div> : null,
	DrawerContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	DrawerDescription: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		passkey: {
			listUserPasskeys: mocks.listUserPasskeys,
			deletePasskey: mocks.deletePasskey,
			updatePasskey: mocks.updatePasskey,
			addPasskey: mocks.addPasskey,
		},
	},
}));

const ADDED_ON_PATTERN = /^Added /;
const PASSKEY_NAME_LABEL = /^Passkey name/;

const PASSKEY = {
	backedUp: true,
	createdAt: "2026-04-11T03:00:00.000Z",
	id: "pk1",
	name: "MacBook",
};

describe("Passkeys", () => {
	let restoreWebAuthn: () => void;

	beforeEach(() => {
		mocks.listUserPasskeys.mockReset();
		mocks.deletePasskey.mockReset();
		mocks.updatePasskey.mockReset();
		mocks.addPasskey.mockReset();
		restoreWebAuthn = stubWebAuthnSupport(true);
	});

	afterEach(() => {
		restoreWebAuthn();
	});

	it("shows an empty state and the add button when no passkey is registered", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [] });
		render(<Passkeys />);

		expect(screen.getByText("Loading passkeys...")).toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByText(
					"No passkeys yet. Add one to sign in without a password."
				)
			).toBeInTheDocument()
		);
		expect(
			screen.getByRole("button", { name: "Add passkey" })
		).toBeInTheDocument();
	});

	it("lists registered passkeys with their name and added date", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY] });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		expect(screen.getByText("Synced")).toBeInTheDocument();
		expect(screen.getByText(ADDED_ON_PATTERN)).toBeInTheDocument();
	});

	it("asks for confirmation before removing a passkey", async () => {
		const user = userEvent.setup();
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY] });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Remove MacBook" }));

		expect(
			await screen.findByRole("heading", { name: "Remove passkey?" })
		).toBeInTheDocument();
		expect(mocks.deletePasskey).not.toHaveBeenCalled();
	});

	it("removes the passkey once the confirmation is accepted", async () => {
		const user = userEvent.setup();
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY] });
		mocks.deletePasskey.mockResolvedValue({ data: { status: true } });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Remove MacBook" }));
		await user.click(
			await screen.findByRole("button", { name: "Remove", exact: true })
		);

		await waitFor(() =>
			expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "pk1" })
		);
	});

	it("leaves the passkey alone when the confirmation is cancelled", async () => {
		const user = userEvent.setup();
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY] });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Remove MacBook" }));
		await user.click(await screen.findByRole("button", { name: "Cancel" }));

		await waitFor(() =>
			expect(
				screen.queryByRole("heading", { name: "Remove passkey?" })
			).not.toBeInTheDocument()
		);
		expect(mocks.deletePasskey).not.toHaveBeenCalled();
	});

	it("renames a passkey through a sheet prefilled with its current name", async () => {
		const user = userEvent.setup();
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY] });
		mocks.updatePasskey.mockResolvedValue({ data: { passkey: PASSKEY } });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Rename MacBook" }));

		const nameField = await screen.findByLabelText(PASSKEY_NAME_LABEL);
		expect(nameField).toHaveValue("MacBook");

		await user.clear(nameField);
		await user.type(nameField, "Work laptop");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(mocks.updatePasskey).toHaveBeenCalledWith({
				id: "pk1",
				name: "Work laptop",
			})
		);
	});

	it("seeds the rename sheet from whichever passkey was targeted", async () => {
		const user = userEvent.setup();
		const other = { ...PASSKEY, id: "pk2", name: "Pixel 9" };
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY, other] });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Rename MacBook" }));
		expect(await screen.findByLabelText(PASSKEY_NAME_LABEL)).toHaveValue(
			"MacBook"
		);

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await user.click(screen.getByRole("button", { name: "Rename Pixel 9" }));
		expect(await screen.findByLabelText(PASSKEY_NAME_LABEL)).toHaveValue(
			"Pixel 9"
		);
	});

	it("reports the fetch failure instead of an empty list", async () => {
		mocks.listUserPasskeys.mockRejectedValue(new Error("offline"));
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Unable to load passkeys"
			)
		);
		expect(
			screen.queryByText(
				"No passkeys yet. Add one to sign in without a password."
			)
		).not.toBeInTheDocument();
	});

	it("keeps the page usable when the fetch fails", async () => {
		mocks.listUserPasskeys.mockRejectedValue(new Error("offline"));
		render(<Passkeys />);

		await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
		expect(
			screen.getByRole("button", { name: "Add passkey" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
	});

	it("recovers through Retry without a page reload", async () => {
		const user = userEvent.setup();
		mocks.listUserPasskeys
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ data: [PASSKEY] });
		render(<Passkeys />);

		await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
		await user.click(screen.getByRole("button", { name: "Retry" }));

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("replaces the add button with a notice where WebAuthn is missing", async () => {
		stubWebAuthnSupport(false);
		mocks.listUserPasskeys.mockResolvedValue({ data: [] });
		render(<Passkeys />);

		await waitFor(() =>
			expect(
				screen.getByText("This browser does not support passkeys.")
			).toBeInTheDocument()
		);
		expect(
			screen.queryByRole("button", { name: "Add passkey" })
		).not.toBeInTheDocument();
	});
});
