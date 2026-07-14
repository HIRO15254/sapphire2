import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { IconPhoto, IconSparkles, IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { useAiExtractInput } from "./use-ai-extract-input";

interface AiExtractInputProps {
	onExtracted: (data: ExtractedTournamentData) => void;
}

export function AiExtractInput({ onExtracted }: AiExtractInputProps) {
	const {
		items,
		fileInputRef,
		canAdd,
		isPending,
		error,
		removeItem,
		handleImageSelect,
		handleAnalyze,
		triggerFileInput,
	} = useAiExtractInput({ onExtracted });

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-1.5">
				{items.map((item) => (
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
				))}
			</div>

			{canAdd && (
				<div className="flex gap-1.5">
					<Button
						onClick={triggerFileInput}
						size="xs"
						type="button"
						variant="outline"
					>
						<IconPhoto size={12} />
						Add Image
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

			{error && (
				<p className="text-destructive text-xs" role="alert">
					{error.message}
				</p>
			)}

			<Button
				disabled={isPending}
				onClick={handleAnalyze}
				size="sm"
				type="button"
			>
				<IconSparkles size={14} />
				{isPending ? "Analyzing..." : "Analyze"}
			</Button>
		</div>
	);
}
