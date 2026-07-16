import { IconArrowLeft, IconDotsVertical } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";

interface TopBarProps {
	onOpenActions?: () => void;
}

export function TopBar({ onOpenActions }: TopBarProps) {
	return (
		<div className="mb-2 flex items-center justify-between">
			<Button asChild className="-ml-2" size="sm" variant="ghost">
				<Link to="/items">
					<IconArrowLeft size={18} />
					Back
				</Link>
			</Button>
			{onOpenActions ? (
				<Button
					aria-label="More actions"
					className="-mr-2"
					onClick={onOpenActions}
					size="icon-lg"
					variant="ghost"
				>
					<IconDotsVertical size={20} />
				</Button>
			) : null}
		</div>
	);
}
