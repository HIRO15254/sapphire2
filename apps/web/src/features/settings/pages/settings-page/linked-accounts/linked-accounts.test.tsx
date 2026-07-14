import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedAccounts } from "./linked-accounts";

const NEW_PASSWORD_RE = /New password/;
const CONFIRM_PASSWORD_RE = /Confirm password/;

const mocks = vi.hoisted(() => ({
	fetchSetPassword: vi.fn(),
	linkSocial: vi.fn(),
	listAccounts: vi.fn(),
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
	unlinkAccount: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		$fetch: mocks.fetchSetPassword,
		linkSocial: mocks.linkSocial,
		listAccounts: mocks.listAccounts,
		unlinkAccount: mocks.unlinkAccount,
	},
}));

vi.mock("sonner", () => ({
	toast: {
		error: mocks.toastError,
		success: mocks.toastSuccess,
	},
}));

describe("LinkedAccounts", () => {
	beforeEach(() => {
		mocks.fetchSetPassword.mockReset();
		mocks.linkSocial.mockReset();
		mocks.listAccounts.mockReset();
		mocks.toastError.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.unlinkAccount.mockReset();
	});

	it("shows the set password action when credential login is not linked", async () => {
		const user = userEvent.setup();

		mocks.listAccounts.mockResolvedValue({
			data: [{ accountId: "google-1", id: "1", providerId: "google" }],
		});

		render(<LinkedAccounts />);

		await screen.findByText("Email / password");
		expect(screen.getByRole("button", { name: "Set password" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Unlink" })).toBeDisabled();

		await user.click(screen.getByRole("button", { name: "Set password" }));

		// FormSheet renders the title in the sheet toolbar plus an sr-only
		// description, and the password fields inside the sheet body.
		expect(screen.getAllByText("Set password").length).toBeGreaterThanOrEqual(
			1
		);
		expect(screen.getByLabelText(NEW_PASSWORD_RE)).toBeInTheDocument();
		expect(screen.getByLabelText(CONFIRM_PASSWORD_RE)).toBeInTheDocument();
		expect(screen.getByLabelText("Save")).toHaveAttribute(
			"form",
			"set-password-form"
		);
	});

	it("does not render the set password sheet body until opened", async () => {
		mocks.listAccounts.mockResolvedValue({
			data: [{ accountId: "google-1", id: "1", providerId: "google" }],
		});

		render(<LinkedAccounts />);

		await screen.findByText("Email / password");
		expect(screen.queryByLabelText(NEW_PASSWORD_RE)).not.toBeInTheDocument();
	});

	it("shows an error instead of loading indefinitely when accounts cannot be loaded", async () => {
		mocks.listAccounts.mockRejectedValue(new Error("Network unavailable"));

		render(<LinkedAccounts />);

		expect(
			await screen.findByText("Unable to load linked accounts")
		).toBeVisible();
		expect(screen.queryByText("Loading accounts...")).not.toBeInTheDocument();
	});

	it("submits the new password via the FormSheet Save button and reloads accounts", async () => {
		const user = userEvent.setup();

		mocks.listAccounts.mockResolvedValue({
			data: [{ accountId: "google-1", id: "1", providerId: "google" }],
		});
		mocks.fetchSetPassword.mockResolvedValue({ error: null });

		render(<LinkedAccounts />);

		await screen.findByText("Email / password");
		await user.click(screen.getByRole("button", { name: "Set password" }));

		await user.type(screen.getByLabelText(NEW_PASSWORD_RE), "supersecret1");
		await user.type(screen.getByLabelText(CONFIRM_PASSWORD_RE), "supersecret1");
		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(mocks.fetchSetPassword).toHaveBeenCalledTimes(1);
		});
		expect(mocks.fetchSetPassword).toHaveBeenCalledWith("/set-password", {
			method: "POST",
			body: { newPassword: "supersecret1" },
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Password set successfully"
		);
		// onSuccess refetches the account list (initial load + refresh).
		await waitFor(() => {
			expect(mocks.listAccounts).toHaveBeenCalledTimes(2);
		});
	});

	it("allows unlinking a provider when another login method is available", async () => {
		const user = userEvent.setup();

		mocks.listAccounts.mockResolvedValue({
			data: [
				{ accountId: "credential-1", id: "1", providerId: "credential" },
				{ accountId: "google-1", id: "2", providerId: "google" },
			],
		});
		mocks.unlinkAccount.mockResolvedValue({ error: null });

		render(<LinkedAccounts />);

		await screen.findByText("Google");
		await user.click(screen.getByRole("button", { name: "Unlink" }));

		await waitFor(() => {
			expect(mocks.unlinkAccount).toHaveBeenCalledWith({
				providerId: "google",
			});
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Account unlinked");
	});
});
