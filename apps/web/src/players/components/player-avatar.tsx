import { IconUser, IconUserQuestion } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
	className?: string;
	isHero?: boolean;
	isTemporary?: boolean;
}

export function PlayerAvatar({
	className,
	isHero = false,
	isTemporary = false,
}: PlayerAvatarProps) {
	return (
		<div
			className={cn(
				"flex size-10 items-center justify-center rounded-full border-2 shadow-md",
				isHero
					? "border-amber-400 bg-amber-500/80 text-white"
					: isTemporary
						? "border-white/20 bg-white/10 text-white/60"
						: "border-white/30 bg-slate-500 text-white",
				className
			)}
		>
			{isTemporary ? <IconUserQuestion size={16} /> : <IconUser size={16} />}
		</div>
	);
}
