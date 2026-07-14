import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { MobileNavItem, SidebarNavItem } from "./app-navigation";

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

function TestIcon() {
	return <svg aria-hidden="true" />;
}

const gamesItem = { icon: TestIcon, label: "Games", to: "/games" };

describe("app navigation current-page semantics", () => {
	it("marks the active desktop Games link as the current page", () => {
		render(<SidebarNavItem active item={gamesItem} />);
		expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
			"aria-current",
			"page"
		);
	});

	it("marks the active mobile Games link as the current page", () => {
		render(<MobileNavItem active item={gamesItem} />);
		expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
			"aria-current",
			"page"
		);
	});

	it("does not mark inactive links as the current page", () => {
		render(<SidebarNavItem active={false} item={gamesItem} />);
		expect(screen.getByRole("link", { name: "Games" })).not.toHaveAttribute(
			"aria-current"
		);
	});
});
