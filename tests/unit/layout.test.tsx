// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { ReactElement } from "react";
import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout metadata", () => {
    it("sets the page title to Moments", () => {
        expect(metadata.title).toBe("Moments");
    });

    it("provides a description string", () => {
        expect(typeof metadata.description).toBe("string");
        expect(metadata.description).toMatch(/photo frame/i);
    });
});

describe("RootLayout structure", () => {
    function tree() {
        return RootLayout({ children: "CONTENT" }) as ReactElement<{
            lang: string;
            children: ReactElement<{ style: Record<string, string>; children: unknown }>;
        }>;
    }

    it("renders an <html> root with lang en", () => {
        const el = tree();
        expect(el.type).toBe("html");
        expect(el.props.lang).toBe("en");
    });

    it("renders a <body> child", () => {
        const body = tree().props.children;
        expect(body.type).toBe("body");
    });

    it("passes children through to the body", () => {
        const body = tree().props.children;
        const children: unknown = body.props.children;
        // body may contain additional sibling elements (e.g. SwRegister)
        const hasContent = Array.isArray(children) ? children.includes("CONTENT") : children === "CONTENT";
        expect(hasContent).toBe(true);
    });

    it("gives the body a black background", () => {
        const body = tree().props.children;
        expect(body.props.style.background).toBe("#000");
    });
});
