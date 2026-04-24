import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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
			<div data-testid={`dialog-${title}`}>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

describe("SessionTagManager", () => {
	it("edits and saves a session tag", async () => {
		const user = userEvent.setup();

		render(<SessionTagManager />);

		await user.click(screen.getByLabelText("Edit tag Series"));

		const input = screen.getByRole("textbox");
		await user.clear(input);
		await user.type(input, "Weekly");
		await user.click(screen.getByRole("button", { name: "Save" }));

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

		await user.click(screen.getByLabelText("Delete tag Series"));
		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "tag-1" });
		});
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
