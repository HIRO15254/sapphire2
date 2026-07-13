import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

function TestIcon() {
	return <svg aria-hidden="true" />;
}

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: {
		children: React.ReactNode;
		to: string;
	} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/features/live-sessions/components/create-session-dialog", () => ({
	CreateSessionDialog: () => null,
}));

vi.mock("@/shared/components/app-navigation", () => ({
	isActiveItem: (
		pathname: string,
		item: { matchPaths?: string[]; to: string }
	) => item.to === pathname || item.matchPaths?.includes(pathname) === true,
	MobileNavItem: () => null,
	NavigationCenterButton: () => null,
	RESOURCE_ITEMS: [{ icon: TestIcon, label: "Games", to: "/games" }],
}));

vi.mock("@/shared/components/ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	PopoverContent: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("@/shared/hooks/use-mobile-nav-popover", () => ({
	useMobileNavPopover: () => ({
		isOpen: true,
		onClose: vi.fn(),
		onOpenChange: vi.fn(),
	}),
}));

vi.mock("./use-mobile-nav", () => ({
	useMobileNav: () => ({
		centerAction: {
			icon: TestIcon,
			label: "Start",
			onClick: vi.fn(),
			tone: "accent",
		},
		hasActive: false,
		isCreateOpen: false,
		leftItems: [],
		onCreateOpenChange: vi.fn(),
		pathname: "/games",
		rightItems: [
			{
				icon: TestIcon,
				label: "Resources",
				matchPaths: ["/games"],
				to: "/resources",
			},
		],
	}),
}));

import { MobileNav } from "./mobile-nav";

describe("MobileNav", () => {
	it("marks the active Games link inside Resources as the current page", () => {
		render(<MobileNav />);
		expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
			"aria-current",
			"page"
		);
	});
});
