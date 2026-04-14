import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
	className?: string;
	isHero?: boolean;
	name: string;
}

export function PlayerAvatar({
	className,
	isHero = false,
	name,
}: PlayerAvatarProps) {
	return (
		<div
			className={cn(
				"flex size-9 items-center justify-center rounded-full border-2 font-bold text-[11px] text-white shadow-md",
				isHero
					? "border-amber-400 bg-amber-500/80"
					: "border-white/30 bg-slate-500",
				className
			)}
		>
			{name.slice(0, 2).toUpperCase()}
		</div>
	);
}
