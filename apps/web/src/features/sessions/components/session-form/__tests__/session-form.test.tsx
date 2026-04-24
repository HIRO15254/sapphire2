import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionForm } from "@/features/sessions/components/session-form/session-form";

const LIVE_SESSION_REGEX = /this session is generated from a live session/i;
const EDITABLE_REGEX = /items calculated from event history cannot be edited/i;
const MODIFY_REGEX = /to modify, edit the events in the live session/i;

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

describe("SessionForm", () => {
	it("displays live-linked alert with English text when isLiveLinked is true", () => {
		const qc = createClient();
		render(
			<SessionForm
				currencies={[]}
				isLiveLinked={true}
				onSubmit={vi.fn()}
				ringGames={[]}
				stores={[]}
				tags={[]}
				tournaments={[]}
			/>,
			{ wrapper: wrapper(qc) }
		);

		expect(screen.getByText(LIVE_SESSION_REGEX)).toBeInTheDocument();
		expect(screen.getByText(EDITABLE_REGEX)).toBeInTheDocument();
		expect(screen.getByText(MODIFY_REGEX)).toBeInTheDocument();
	});

	it("does not display live-linked alert when isLiveLinked is false", () => {
		const qc = createClient();
		render(
			<SessionForm
				currencies={[]}
				isLiveLinked={false}
				onSubmit={vi.fn()}
				ringGames={[]}
				stores={[]}
				tags={[]}
				tournaments={[]}
			/>,
			{ wrapper: wrapper(qc) }
		);

		expect(screen.queryByText(LIVE_SESSION_REGEX)).not.toBeInTheDocument();
	});
});
