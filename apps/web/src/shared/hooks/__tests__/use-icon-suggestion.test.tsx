import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { initTRPC } from "@trpc/server";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import z from "zod";
import { trpcHttpHandler } from "@/__tests__/integration";
import { createTestQueryClient } from "@/__tests__/test-utils";
import { useIconSuggestion } from "../use-icon-suggestion";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

const t = initTRPC.create();
const keywordRequests: string[] = [];
let keywordGate: Promise<void> | undefined;
const router = t.router({
	aiExtract: t.router({
		suggestIconKeywords: t.procedure
			.input(z.object({ name: z.string() }))
			.mutation(async ({ input }) => {
				keywordRequests.push(input.name);
				await keywordGate;
				return { keywords: ["percentage", "money"] };
			}),
	}),
});
const server = setupServer(trpcHttpHandler("http://localhost:8787", router));

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
	keywordRequests.length = 0;
	keywordGate = undefined;
});

function setup(initialIcon: string) {
	const state = { icon: initialIcon, name: "" };
	const queryClient = createTestQueryClient();
	const { result } = renderHook(
		() =>
			useIconSuggestion({
				getIcon: () => state.icon,
				getName: () => state.name,
				initialIcon,
				setIcon: (name) => {
					state.icon = name;
				},
			}),
		{
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			),
		}
	);
	const blur = (name: string) => {
		state.name = name;
		return act(() => result.current.onNameBlur(name));
	};
	return { blur, result, state };
}

describe("useIconSuggestion", () => {
	it("fills an unset icon from the name and follows later renames", async () => {
		const { blur, state } = setup("");

		await blur("Coffee");
		expect(state.icon).toBe("coffee");

		await blur("Pizza");
		expect(state.icon).toBe("pizza");
		expect(keywordRequests).toEqual([]);
	});

	it("never overwrites an icon the user picked, including None", async () => {
		const { blur, result, state } = setup("");

		act(() => result.current.onIconChosen());
		await blur("Coffee");

		expect(state.icon).toBe("");
	});

	it("keeps the existing icon of an item opened for editing", async () => {
		const { blur, state } = setup("gift");

		await blur("Coffee");

		expect(state.icon).toBe("gift");
		expect(keywordRequests).toEqual([]);
	});

	it("asks for keywords once when the rules find nothing, then searches them", async () => {
		const { blur, state } = setup("");

		await blur("レーキバック");
		expect(state.icon).toBe("percentage");

		state.icon = "";
		await blur("レーキバック");
		expect(keywordRequests).toEqual(["レーキバック"]);
	});

	it("drops keywords that arrive after the user picked an icon or renamed", async () => {
		const gate = Promise.withResolvers<void>();
		keywordGate = gate.promise;
		const { result, state } = setup("");

		state.name = "賞金";
		const picked = act(() => result.current.onNameBlur("賞金"));
		await vi.waitFor(() => expect(keywordRequests).toEqual(["賞金"]));
		act(() => result.current.onIconChosen());
		state.icon = "star";
		gate.resolve();
		await picked;
		expect(state.icon).toBe("star");

		const renamed = setup("");
		keywordGate = undefined;
		renamed.state.name = "手数料";
		const pending = act(() => renamed.result.current.onNameBlur("手数料"));
		renamed.state.name = "Something else";
		await pending;
		expect(renamed.state.icon).toBe("");
	});
});
