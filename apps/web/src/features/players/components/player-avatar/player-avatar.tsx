import { IconUser, IconUserQuestion } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";

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
		<Avatar
			className={cn(
				"size-10 border-2 shadow-md after:hidden",
				isHero && "border-amber-400",
				!isHero && isTemporary && "border-zinc-500/60",
				!(isHero || isTemporary) && "border-white/30",
				className
			)}
		>
			<AvatarFallback
				className={cn(
					isHero && "bg-amber-500/80 text-white",
					!isHero && isTemporary && "bg-zinc-700 text-white/80",
					!(isHero || isTemporary) && "bg-slate-500 text-white"
				)}
			>
				{isTemporary ? <IconUserQuestion size={16} /> : <IconUser size={16} />}
			</AvatarFallback>
		</Avatar>
	);
}
