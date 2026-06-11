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
	createMutate: vi.fn(async () => undefined),
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
			create: { mutate: mocks.createMutate },
			delete: { mutate: mocks.deleteMutate },
			update: { mutate: mocks.updateMutate },
		},
	},
}));

describe("SessionTagManager", () => {
	it("creates a session tag through the New tag form sheet", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByRole("button", { name: "New tag" }));

		await user.type(screen.getByRole("textbox"), "Online");
		// The FormSheet toolbar Save button submits the form via `form={formId}`.
		await user.click(screen.getByLabelText("Save"));

		await waitFor(() => {
			expect(mocks.createMutate).toHaveBeenCalledTimes(1);
		});
		expect(mocks.createMutate).toHaveBeenCalledWith({ name: "Online" });
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
			expect(mocks.updateMutate).toHaveBeenCalledWith({
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
			expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "tag-1" });
		});
	});

	it("closes the delete dialog without deleting when Cancel is clicked", async () => {
		const user = userEvent.setup();
		mocks.deleteMutate.mockClear();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Delete tag Series"));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "Delete tag?" })
			).not.toBeInTheDocument();
		});
		expect(mocks.deleteMutate).not.toHaveBeenCalled();
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
