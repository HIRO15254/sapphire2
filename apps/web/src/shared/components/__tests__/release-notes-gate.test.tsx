import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lastSeenReleaseVersionStorageKey } from "@/lib/release-notes";
import { ReleaseNotesGate } from "@/shared/components/release-notes-gate";

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
				<h1>{title}</h1>
				{children}
			</div>
		) : null,
}));

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe("ReleaseNotesGate", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					version: "1.2.0",
					releasedAt: "2026-04-03T00:00:00.000Z",
					changes: {
						user: [
							{
								title: "Session tags",
								summary: "Manage tags in settings.",
							},
						],
						developer: [],
					},
				}),
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("shows the latest notes once and stores the seen version", async () => {
		const wrapper = createWrapper();
		render(<ReleaseNotesGate />, { wrapper });

		await screen.findByText("What's new in v1.2.0");
		fireEvent.click(screen.getByRole("button", { name: "Got it" }));

		await waitFor(() => {
			expect(
				window.localStorage.getItem(lastSeenReleaseVersionStorageKey)
			).toBe("1.2.0");
		});
	});

	it("skips the modal when the version was already seen", async () => {
		window.localStorage.setItem(lastSeenReleaseVersionStorageKey, "1.2.0");
		const wrapper = createWrapper();
		render(<ReleaseNotesGate />, { wrapper });

		await waitFor(() => {
			expect(
				screen.queryByText("What's new in v1.2.0")
			).not.toBeInTheDocument();
		});
	});
});
