import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionTagManager } from "../session-tag-manager";

const mocks = vi.hoisted(() => ({
	deleteMutate: vi.fn(async () => undefined),
	invalidateQueries: vi.fn(),
	tags: [{ id: "tag-1", name: "Series" }],
	updateMutate: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
		onSettled?: () => void;
		onSuccess?: () => void;
	}) => {
		const mutate = async (arg: unknown) => {
			const result = await options.mutationFn(arg);
			await options.onSuccess?.();
			await options.onSettled?.();
			return result;
		};
		return {
			isPending: false,
			mutate,
			mutateAsync: mutate,
		};
	},
	useQuery: () => ({ data: mocks.tags }),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: vi.fn(),
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: {
				queryOptions: () => ({ queryKey: ["sessions"] }),
			},
		},
		sessionTag: {
			list: {
				queryOptions: () => ({ queryKey: ["session-tags"] }),
			},
		},
	},
	trpcClient: {
		sessionTag: {
			delete: { mutate: mocks.deleteMutate },
			update: { mutate: mocks.updateMutate },
		},
	},
}));

describe("SessionTagManager", () => {
	it("edits and saves a session tag", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Edit tag"));
		await user.clear(screen.getByRole("textbox"));
		await user.type(screen.getByRole("textbox"), "Weekly");
		await user.click(screen.getByLabelText("Save tag"));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith({
				id: "tag-1",
				name: "Weekly",
			});
		});
	});

	it("confirms and deletes a session tag", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Delete tag"));
		await user.click(screen.getByLabelText("Confirm delete tag"));

		await waitFor(() => {
			expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "tag-1" });
		});
	});
});
