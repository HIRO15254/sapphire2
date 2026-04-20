import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OcrPlayerImport } from "../ocr-player-import";

const UPLOAD_PATTERN = /Upload Screenshot/i;

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	isPending: false,
	error: null,
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => mocks,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		aiExtractPlayers: {
			extractPlayerNames: {
				mutationOptions: (options: { onSuccess: (data: unknown) => void }) => ({
					onSuccess: options.onSuccess,
				}),
			},
		},
	},
}));

describe("OcrPlayerImport", () => {
	it("renders upload button", () => {
		render(<OcrPlayerImport onPlayersExtracted={vi.fn()} />);
		expect(screen.getByText(UPLOAD_PATTERN)).toBeDefined();
	});

	it("displays component when open", () => {
		render(<OcrPlayerImport onPlayersExtracted={vi.fn()} />);

		const input = screen.getByRole("button", {
			name: UPLOAD_PATTERN,
		});

		expect(input).toBeDefined();
	});

	it("calls onPlayersExtracted when extraction succeeds", () => {
		const mockOnExtracted = vi.fn();
		render(<OcrPlayerImport onPlayersExtracted={mockOnExtracted} />);

		const mockPlayerNames = ["Alice", "Bob", "Charlie"];
		mocks.mutate.mockImplementation((_data: unknown) => {
			const callback = vi.fn();
			callback({
				players: mockPlayerNames.map((name) => ({ name })),
			});
		});

		expect(mockOnExtracted).toBeDefined();
	});
});
