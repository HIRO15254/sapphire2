import { useEffect, useRef } from "react";

const ALLOWED_TAGS = new Set([
	"P",
	"H2",
	"H3",
	"UL",
	"OL",
	"LI",
	"STRONG",
	"EM",
	"A",
	"BR",
	"BLOCKQUOTE",
]);

function sanitizeHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const clean = (node: Node): void => {
		const children = Array.from(node.childNodes);
		for (const child of children) {
			if (child.nodeType === Node.ELEMENT_NODE) {
				const el = child as Element;
				if (!ALLOWED_TAGS.has(el.tagName)) {
					el.replaceWith(...Array.from(el.childNodes));
					continue;
				}
				const attrs = Array.from(el.attributes);
				for (const attr of attrs) {
					if (
						el.tagName === "A" &&
						(attr.name === "href" ||
							attr.name === "rel" ||
							attr.name === "target")
					) {
						continue;
					}
					el.removeAttribute(attr.name);
				}
				clean(el);
			}
		}
	};
	clean(doc.body);
	return doc.body.innerHTML;
}

export function useSafeHtml(html: string) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current) {
			ref.current.innerHTML = sanitizeHtml(html);
		}
	}, [html]);

	return { ref };
}
