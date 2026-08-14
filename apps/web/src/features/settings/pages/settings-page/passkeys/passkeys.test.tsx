import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubWebAuthnSupport } from "@/__tests__/test-utils";
import { Passkeys } from "./passkeys";

const mocks = vi.hoisted(() => ({
	listUserPasskeys: vi.fn(),
	deletePasskey: vi.fn(),
	addPasskey: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		passkey: {
			listUserPasskeys: mocks.listUserPasskeys,
			deletePasskey: mocks.deletePasskey,
			addPasskey: mocks.addPasskey,
		},
	},
}));

const ADDED_ON_PATTERN = /^Added /;

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

	it("removes a passkey through its Remove button", async () => {
		const user = userEvent.setup();
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY] });
		mocks.deletePasskey.mockResolvedValue({ data: { status: true } });
		render(<Passkeys />);

		await waitFor(() =>
			expect(screen.getByText("MacBook")).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Remove MacBook" }));

		await waitFor(() =>
			expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "pk1" })
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
