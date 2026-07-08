import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useUserMenu } from "./use-user-menu";

export function UserMenu() {
	const { session, isPending, updateNotesSheet, onSignOut } = useUserMenu();

	if (isPending) {
		return <Skeleton className="h-8 w-24" />;
	}

	if (!session) {
		return (
			<Link to="/login">
				<Button className="h-8 px-3" size="sm" variant="outline">
					Sign In
				</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button className="h-8 max-w-32 px-3" size="sm" variant="outline">
					<span className="truncate">{session.user.name}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
					<DropdownMenuItem onClick={updateNotesSheet.open}>
						Update Notes
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onSignOut} variant="destructive">
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default UserMenu;
