import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { AiExtractInput } from "@/features/stores/components/ai-extract-input/ai-extract-input";

const ADD_URL_REGEX = /add url/i;
const ADD_IMAGE_REGEX = /add image/i;
const ANALYZE_REGEX = /analyze/i;

vi.mock("@/utils/trpc", () => ({
	trpc: {
		aiExtract: {
			extractTournamentData: {
				mutationOptions: () => ({
					mutationKey: ["aiExtract", "extractTournamentData"],
					mutationFn: vi.fn(),
				}),
			},
		},
	},
}));

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("AiExtractInput", () => {
	it("displays Add URL button with English text", () => {
		const qc = createClient();
		render(<AiExtractInput onExtracted={vi.fn()} />, {
			wrapper: wrapper(qc),
		});

		expect(
			screen.getByRole("button", { name: ADD_URL_REGEX })
		).toBeInTheDocument();
	});

	it("displays Add Image button with English text", () => {
		const qc = createClient();
		render(<AiExtractInput onExtracted={vi.fn()} />, {
			wrapper: wrapper(qc),
		});

		expect(
			screen.getByRole("button", { name: ADD_IMAGE_REGEX })
		).toBeInTheDocument();
	});

	it("displays Analyze button with English text when not pending", () => {
		const qc = createClient();
		render(<AiExtractInput onExtracted={vi.fn()} />, {
			wrapper: wrapper(qc),
		});

		expect(
			screen.getByRole("button", { name: ANALYZE_REGEX })
		).toBeInTheDocument();
	});
});
