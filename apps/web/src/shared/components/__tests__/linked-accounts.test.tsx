import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedAccounts } from "../linked-accounts";

const mocks = vi.hoisted(() => ({
	fetchSetPassword: vi.fn(),
	linkSocial: vi.fn(),
	listAccounts: vi.fn(),
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
	unlinkAccount: vi.fn(),
}));

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

		await screen.findByText("Email / Password");
		expect(screen.getByRole("button", { name: "Set Password" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Unlink" })).toBeDisabled();

		await user.click(screen.getByRole("button", { name: "Set Password" }));

		expect(
			screen.getByRole("heading", { name: "Set Password" })
		).toBeInTheDocument();
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
