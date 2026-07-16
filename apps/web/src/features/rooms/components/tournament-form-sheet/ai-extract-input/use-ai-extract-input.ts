import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

export interface ImageItem {
	base64: string;
	id: string;
	kind: "image";
	mediaType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
	name: string;
	previewUrl: string;
}

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
	const [items, setItems] = useState<ImageItem[]>([]);
	const itemsRef = useRef<ImageItem[]>([]);
	const previewUrlsRef = useRef(new Set<string>());
	const fileInputRef = useRef<HTMLInputElement>(null);

	const mutation = useMutation(
		trpc.aiExtract.extractTournamentData.mutationOptions({
			onSuccess: onExtracted,
		})
	);

	useEffect(
		() => () => {
			for (const previewUrl of previewUrlsRef.current) {
				URL.revokeObjectURL(previewUrl);
			}
			previewUrlsRef.current.clear();
		},
		[]
	);

	const removeItem = (id: string) => {
		const item = itemsRef.current.find((candidate) => candidate.id === id);
		if (!item) {
			return;
		}
		itemsRef.current = itemsRef.current.filter(
			(candidate) => candidate.id !== id
		);
		setItems(itemsRef.current);
		if (previewUrlsRef.current.delete(item.previewUrl)) {
			URL.revokeObjectURL(item.previewUrl);
		}
	};

	const handleImageSelect = async (
		e: React.ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const input = e.target;
		const file = input.files?.[0];
		if (!file) {
			return;
		}
		const mediaType = file.type;
		if (!isAcceptedMediaType(mediaType)) {
			return;
		}
		if (itemsRef.current.length >= 5) {
			return;
		}

		const base64 = await fileToBase64(file);
		if (itemsRef.current.length >= 5) {
			return;
		}
		const previewUrl = URL.createObjectURL(file);
		const item: ImageItem = {
			id: crypto.randomUUID(),
			kind: "image",
			base64,
			mediaType,
			name: file.name,
			previewUrl,
		};
		previewUrlsRef.current.add(previewUrl);
		itemsRef.current = [...itemsRef.current, item];
		setItems(itemsRef.current);
		input.value = "";
	};

	const handleAnalyze = () => {
		if (itemsRef.current.length === 0) {
			return;
		}
		mutation.mutate({
			sources: itemsRef.current.map((item) => ({
				kind: "image" as const,
				data: item.base64,
				mediaType: item.mediaType,
			})),
		});
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
		removeItem,
		handleImageSelect,
		handleAnalyze,
		triggerFileInput,
	};
}
