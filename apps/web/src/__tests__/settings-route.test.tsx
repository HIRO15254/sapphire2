import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/shared/components/linked-accounts", () => ({
	LinkedAccounts: () => <div>Linked Accounts Content</div>,
}));

vi.mock("@/currencies/components/transaction-type-manager", () => ({
	TransactionTypeManager: () => <div>Transaction Types Content</div>,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: mocks.signOut,
	},
}));

let routeModule: typeof import("@/routes/settings");

describe("SettingsComponent", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/settings");
	});

	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.signOut.mockReset();
		mocks.signOut.mockImplementation(
			(options?: { fetchOptions?: { onSuccess?: () => void } }) => {
				options?.fetchOptions?.onSuccess?.();
			}
		);
	});

	it("renders the page header and section helper text", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "Settings" })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Manage login methods and shared labels used across the app."
			)
		).toBeInTheDocument();
		expect(screen.getByText("Linked Accounts")).toBeInTheDocument();
		expect(screen.getByText("Transaction Types")).toBeInTheDocument();
	});

	it("signs out from the page header action", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		await user.click(screen.getByRole("button", { name: "Sign Out" }));

		expect(mocks.signOut).toHaveBeenCalledOnce();
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
	});
});
