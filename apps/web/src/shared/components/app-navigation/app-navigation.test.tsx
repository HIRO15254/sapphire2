import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import {
	MobileNavItem,
	NORMAL_NAV_ITEMS,
	RESOURCE_ITEMS,
	SIDEBAR_ITEMS,
	SidebarNavItem,
} from "./app-navigation";

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

describe("Items registration in the nav item lists", () => {
	it("registers Items in RESOURCE_ITEMS right after Currencies", () => {
		const labels = RESOURCE_ITEMS.map((item) => item.label);
		expect(labels.indexOf("Items")).toBe(labels.indexOf("Currencies") + 1);
		const itemsEntry = RESOURCE_ITEMS.find((item) => item.label === "Items");
		expect(itemsEntry?.to).toBe("/items");
	});

	it("registers Items in SIDEBAR_ITEMS right after Currencies", () => {
		const labels = SIDEBAR_ITEMS.map((item) => item.label);
		expect(labels.indexOf("Items")).toBe(labels.indexOf("Currencies") + 1);
		const itemsEntry = SIDEBAR_ITEMS.find((item) => item.label === "Items");
		expect(itemsEntry?.to).toBe("/items");
	});

	it("matches /items against the mobile Resources tab (matchPaths)", () => {
		const resources = NORMAL_NAV_ITEMS.find(
			(item) => item.label === "Resources"
		);
		expect(resources?.matchPaths).toContain("/items");
	});
});
