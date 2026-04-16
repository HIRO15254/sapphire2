import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import {
	IconPhoto,
	IconPlus,
	IconSparkles,
	IconTrash,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { trpc } from "@/utils/trpc";

interface UrlItem {
	id: string;
	kind: "url";
	value: string;
}
interface ImageItem {
	base64: string;
	id: string;
	kind: "image";
	mediaType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
	name: string;
	previewUrl: string;
}
type SourceItem = ImageItem | UrlItem;

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

interface AiExtractInputProps {
	onExtracted: (data: ExtractedTournamentData) => void;
}

export function AiExtractInput({ onExtracted }: AiExtractInputProps) {
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

	const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

	const canAdd = items.length < 5;

	return (
		<div className="mb-4 flex flex-col gap-2 rounded-md border p-3">
			<p className="font-medium text-sm">URLまたは画像から自動入力</p>

			<div className="flex flex-col gap-1.5">
				{items.map((item) =>
					item.kind === "url" ? (
						<div className="flex items-center gap-1.5" key={item.id}>
							<Input
								className="h-8 flex-1 text-sm"
								onChange={(e) => updateUrl(item.id, e.target.value)}
								placeholder="https://..."
								type="url"
								value={item.value}
							/>
							{items.length > 1 && (
								<Button
									aria-label="Remove URL"
									onClick={() => removeItem(item.id)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconTrash size={12} />
								</Button>
							)}
						</div>
					) : (
						<div className="flex items-center gap-1.5" key={item.id}>
							<div className="flex flex-1 items-center gap-2 rounded-md border px-2 py-1">
								<img
									alt={item.name}
									className="h-6 w-6 rounded object-cover"
									height={24}
									src={item.previewUrl}
									width={24}
								/>
								<span className="truncate text-xs">{item.name}</span>
							</div>
							<Button
								aria-label="Remove image"
								onClick={() => removeItem(item.id)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<IconTrash size={12} />
							</Button>
						</div>
					)
				)}
			</div>

			{canAdd && (
				<div className="flex gap-1.5">
					<Button onClick={addUrl} size="xs" type="button" variant="outline">
						<IconPlus size={12} />
						URLを追加
					</Button>
					<Button
						onClick={() => fileInputRef.current?.click()}
						size="xs"
						type="button"
						variant="outline"
					>
						<IconPhoto size={12} />
						画像を追加
					</Button>
					<input
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="hidden"
						onChange={handleImageSelect}
						ref={fileInputRef}
						type="file"
					/>
				</div>
			)}

			{mutation.error && (
				<p className="text-destructive text-xs">{mutation.error.message}</p>
			)}

			<Button
				disabled={mutation.isPending}
				onClick={handleAnalyze}
				size="sm"
				type="button"
			>
				<IconSparkles size={14} />
				{mutation.isPending ? "解析中..." : "解析"}
			</Button>
		</div>
	);
}
