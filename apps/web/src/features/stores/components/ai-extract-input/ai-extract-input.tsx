import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import {
	IconPhoto,
	IconPlus,
	IconSparkles,
	IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
		addUrl,
		removeItem,
		updateUrl,
		handleImageSelect,
		handleAnalyze,
		triggerFileInput,
	} = useAiExtractInput({ onExtracted });

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-1.5">
				{items.map((item) =>
					item.kind === "url" ? (
						<div className="flex items-center gap-1.5" key={item.id}>
							<Input
								aria-label="URL"
								className="h-8 flex-1 text-sm"
								onChange={(e) => updateUrl(item.id, e.target.value)}
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
						onClick={triggerFileInput}
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

			{error && <p className="text-destructive text-xs">{error.message}</p>}

			<Button
				disabled={isPending}
				onClick={handleAnalyze}
				size="sm"
				type="button"
			>
				<IconSparkles size={14} />
				{isPending ? "解析中..." : "解析"}
			</Button>
		</div>
	);
}
