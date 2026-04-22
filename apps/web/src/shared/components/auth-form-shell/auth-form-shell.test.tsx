import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthFormShell } from "./auth-form-shell";

const GOOGLE_BUTTON_NAME = /Continue with Google/i;

describe("AuthFormShell", () => {
	it("renders description, provider actions, switch action, and footer note", async () => {
		const user = userEvent.setup();
		const onSwitchMode = vi.fn();
		const onProviderClick = vi.fn().mockResolvedValue(undefined);

		render(
			<AuthFormShell
				description="Shell description"
				eyebrow="Authentication"
				footerNote="Footer note"
				onSwitchMode={onSwitchMode}
				providerActions={[
					{
						icon: <span>G</span>,
						label: "Continue with Google",
						onClick: onProviderClick,
					},
				]}
				switchLabel="Switch Mode"
				title="Shell Title"
			>
				<div>Shell Content</div>
			</AuthFormShell>
		);

		expect(screen.getByText("Authentication")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Shell Title" })
		).toBeInTheDocument();
		expect(screen.getByText("Shell description")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: GOOGLE_BUTTON_NAME })
		).toBeInTheDocument();
		expect(screen.getByText("Footer note")).toBeInTheDocument();
		expect(screen.getByText("Shell Content")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Switch Mode" }));
		expect(onSwitchMode).toHaveBeenCalledTimes(1);
	});
});
