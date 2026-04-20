import { IconPhoto, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { trpc } from "@/utils/trpc";

interface ImageData {
	base64: string;
	id: string;
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

interface OcrPlayerImportProps {
	onPlayersExtracted: (playerNames: string[]) => void;
}

export function OcrPlayerImport({ onPlayersExtracted }: OcrPlayerImportProps) {
	const [image, setImage] = useState<ImageData | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const mutation = useMutation(
		trpc.aiExtractPlayers.extractPlayerNames.mutationOptions({
			onSuccess: (data) => {
				const names = data.players.map((p) => p.name).filter((n) => n.trim());
				onPlayersExtracted(names);
				setImage(null);
			},
		})
	);

	const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}
		const mediaType = file.type;
		if (!isAcceptedMediaType(mediaType)) {
			return;
		}

		const base64 = await fileToBase64(file);
		const previewUrl = URL.createObjectURL(file);
		setImage({
			id: crypto.randomUUID(),
			base64,
			mediaType,
			name: file.name,
			previewUrl,
		});
		e.target.value = "";
	};

	const handleExtract = () => {
		if (!image) {
			return;
		}
		mutation.mutate({
			image: {
				data: image.base64,
				mediaType: image.mediaType,
			},
		});
	};

	const removeImage = () => {
		setImage(null);
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-1.5">
				{image ? (
					<div className="flex items-center gap-1.5">
						<div className="flex flex-1 items-center gap-2 rounded-md border px-2 py-1">
							<img
								alt={image.name}
								className="h-6 w-6 rounded object-cover"
								height={24}
								src={image.previewUrl}
								width={24}
							/>
							<span className="truncate text-xs">{image.name}</span>
						</div>
						<Button
							aria-label="Remove image"
							onClick={removeImage}
							size="icon-xs"
							type="button"
							variant="ghost"
						>
							<IconTrash size={12} />
						</Button>
					</div>
				) : (
					<Button
						onClick={() => fileInputRef.current?.click()}
						size="sm"
						type="button"
						variant="outline"
					>
						<IconPhoto size={14} />
						Upload Screenshot
					</Button>
				)}
				<input
					accept="image/jpeg,image/png,image/gif,image/webp"
					className="hidden"
					onChange={handleImageSelect}
					ref={fileInputRef}
					type="file"
				/>
			</div>

			{mutation.error && (
				<p className="text-destructive text-xs">{mutation.error.message}</p>
			)}

			{image && (
				<Button
					disabled={mutation.isPending}
					onClick={handleExtract}
					size="sm"
					type="button"
				>
					{mutation.isPending ? "Extracting..." : "Extract Players"}
				</Button>
			)}
		</div>
	);
}
