import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trpcMocks = vi.hoisted(() => ({
	mutate: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		aiExtract: {
			extractTournamentData: {
				mutationOptions: (opts: unknown) => ({
					mutationKey: ["aiExtract", "extractTournamentData"],
					mutationFn: (vars: unknown) => trpcMocks.mutate(vars),
					...(opts as object),
				}),
			},
		},
	},
}));

import { useAiExtractInput } from "@/features/rooms/components/tournament-form-sheet/ai-extract-input/use-ai-extract-input";

const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

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

function fileInputEvent(file?: File) {
	const target = {
		files: file ? [file] : [],
		value: "selected",
	} as unknown as HTMLInputElement;
	return {
		event: { target } as React.ChangeEvent<HTMLInputElement>,
		target,
	};
}

function imageFile(name = "structure.png", contents = "image") {
	return new File([contents], name, { type: "image/png" });
}

describe("useAiExtractInput", () => {
	beforeEach(() => {
		trpcMocks.mutate.mockReset();
		createObjectURL.mockReset();
		revokeObjectURL.mockReset();
		let nextUrl = 1;
		createObjectURL.mockImplementation(() => `blob:preview-${nextUrl++}`);
		Object.defineProperties(URL, {
			createObjectURL: { configurable: true, value: createObjectURL },
			revokeObjectURL: { configurable: true, value: revokeObjectURL },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("starts with no images and allows adding one", () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		expect(result.current.items).toEqual([]);
		expect(result.current.canAdd).toBe(true);
		expect(result.current.isPending).toBe(false);
	});

	it("ignores image selection when no file is present", async () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const { event } = fileInputEvent();
		await act(async () => {
			await result.current.handleImageSelect(event);
		});
		expect(result.current.items).toEqual([]);
		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it("ignores unsupported image media types", async () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const file = new File(["svg"], "structure.svg", { type: "image/svg+xml" });
		const { event } = fileInputEvent(file);
		await act(async () => {
			await result.current.handleImageSelect(event);
		});
		expect(result.current.items).toEqual([]);
		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it("adds an accepted image with base64 data and resets the file input", async () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const file = imageFile();
		const { event, target } = fileInputEvent(file);
		await act(async () => {
			await result.current.handleImageSelect(event);
		});
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(createObjectURL).toHaveBeenNthCalledWith(1, file);
		expect(result.current.items).toEqual([
			{
				base64: "aW1hZ2U=",
				id: expect.any(String),
				kind: "image",
				mediaType: "image/png",
				name: "structure.png",
				previewUrl: "blob:preview-1",
			},
		]);
		expect(target.value).toBe("");
	});

	it("rejects the selection when FileReader fails", async () => {
		class FailingFileReader {
			onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
			onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
			result: string | ArrayBuffer | null = null;
			readAsDataURL() {
				this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
			}
		}
		vi.stubGlobal("FileReader", FailingFileReader);
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const { event } = fileInputEvent(imageFile());
		let thrown: unknown;
		await act(async () => {
			try {
				await result.current.handleImageSelect(event);
			} catch (error) {
				thrown = error;
			}
		});
		expect(thrown).toBeInstanceOf(ProgressEvent);
		expect(result.current.items).toEqual([]);
		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it("caps the image list at five entries", async () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		for (let index = 0; index < 6; index += 1) {
			const { event } = fileInputEvent(imageFile(`structure-${index}.png`));
			await act(async () => {
				await result.current.handleImageSelect(event);
			});
		}
		expect(result.current.items).toHaveLength(5);
		expect(result.current.canAdd).toBe(false);
		expect(createObjectURL).toHaveBeenCalledTimes(5);
	});

	it("does not analyze when there are no images", () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		act(() => {
			result.current.handleAnalyze();
		});
		expect(trpcMocks.mutate).not.toHaveBeenCalled();
	});

	it("sends only image sources to the extraction mutation", async () => {
		trpcMocks.mutate.mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const { event } = fileInputEvent(imageFile());
		await act(async () => {
			await result.current.handleImageSelect(event);
		});
		act(() => {
			result.current.handleAnalyze();
		});
		await waitFor(() => {
			expect(trpcMocks.mutate).toHaveBeenCalledTimes(1);
			expect(trpcMocks.mutate).toHaveBeenNthCalledWith(1, {
				sources: [{ kind: "image", data: "aW1hZ2U=", mediaType: "image/png" }],
			});
		});
	});

	it("revokes a removed image preview exactly once", async () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const { event } = fileInputEvent(imageFile());
		await act(async () => {
			await result.current.handleImageSelect(event);
		});
		const id = result.current.items[0]?.id;
		act(() => {
			result.current.removeItem(id ?? "missing");
		});
		expect(result.current.items).toEqual([]);
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:preview-1");
	});

	it("does not revoke a preview for an unknown item id", () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		act(() => {
			result.current.removeItem("missing");
		});
		expect(revokeObjectURL).not.toHaveBeenCalled();
	});

	it("revokes every remaining preview exactly once on unmount", async () => {
		const { result, unmount } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		for (let index = 0; index < 2; index += 1) {
			const { event } = fileInputEvent(imageFile(`structure-${index}.png`));
			await act(async () => {
				await result.current.handleImageSelect(event);
			});
		}
		unmount();
		expect(revokeObjectURL).toHaveBeenCalledTimes(2);
		expect(revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:preview-1");
		expect(revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:preview-2");
	});

	it("triggerFileInput clicks the ref element when present", () => {
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(createClient()) }
		);
		const click = vi.fn();
		(
			result.current.fileInputRef as { current: HTMLInputElement | null }
		).current = { click } as unknown as HTMLInputElement;
		act(() => {
			result.current.triggerFileInput();
		});
		expect(click).toHaveBeenCalledTimes(1);
	});
});
