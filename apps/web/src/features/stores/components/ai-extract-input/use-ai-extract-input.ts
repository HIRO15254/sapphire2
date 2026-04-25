import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

export interface UrlItem {
	id: string;
	kind: "url";
	value: string;
}

export interface ImageItem {
	base64: string;
	id: string;
	kind: "image";
	mediaType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
	name: string;
	previewUrl: string;
}

export type SourceItem = ImageItem | UrlItem;

const ACCEPTED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;
type AcceptedMediaType = (typeof ACCEPTED_TYPES)[number];

function isAcceptedMediaType(type: string): type is AcceptedMediaType {
	return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			resolve(result.split(",")[1] ?? "");
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

interface UseAiExtractInputOptions {
	onExtracted: (data: ExtractedTournamentData) => void;
}

export function useAiExtractInput({ onExtracted }: UseAiExtractInputOptions) {
	const [items, setItems] = useState<SourceItem[]>([
		{ id: crypto.randomUUID(), kind: "url", value: "" },
	]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const mutation = useMutation(
		trpc.aiExtract.extractTournamentData.mutationOptions({
			onSuccess: onExtracted,
		})
	);

	const addUrl = () => {
		if (items.length >= 5) {
			return;
		}
		setItems((prev) => [
			...prev,
			{ id: crypto.randomUUID(), kind: "url", value: "" },
		]);
	};

	const removeItem = (id: string) => {
		setItems((prev) => prev.filter((item) => item.id !== id));
	};

	const updateUrl = (id: string, value: string) => {
		setItems((prev) =>
			prev.map((item) =>
				item.id === id && item.kind === "url" ? { ...item, value } : item
			)
		);
	};

	const handleImageSelect = async (
		e: React.ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}
		const mediaType = file.type;
		if (!isAcceptedMediaType(mediaType)) {
			return;
		}
		if (items.length >= 5) {
			return;
		}

		const base64 = await fileToBase64(file);
		const previewUrl = URL.createObjectURL(file);
		setItems((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				kind: "image",
				base64,
				mediaType,
				name: file.name,
				previewUrl,
			},
		]);
		// Reset so same file can be re-selected
		e.target.value = "";
	};

	const handleAnalyze = () => {
		const sources = items.flatMap(
			(item): Parameters<typeof mutation.mutate>[0]["sources"] => {
				if (item.kind === "url") {
					const url = item.value.trim();
					if (!url) {
						return [];
					}
					return [{ kind: "url", url }];
				}
				return [
					{ kind: "image", data: item.base64, mediaType: item.mediaType },
				];
			}
		);
		if (sources.length === 0) {
			return;
		}
		mutation.mutate({ sources });
	};

	const triggerFileInput = () => {
		fileInputRef.current?.click();
	};

	return {
		items,
		fileInputRef,
		canAdd: items.length < 5,
		isPending: mutation.isPending,
		error: mutation.error,
		addUrl,
		removeItem,
		updateUrl,
		handleImageSelect,
		handleAnalyze,
		triggerFileInput,
	};
}
