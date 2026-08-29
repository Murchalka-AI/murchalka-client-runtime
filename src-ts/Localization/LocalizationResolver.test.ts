import { describe, expect, it } from "vitest";
import { LocalizationResolver } from "./LocalizationResolver.js";

describe("LocalizationResolver", () => {
  it("uses exact, language, and default locale fallback in order", () => {
    const resolver = new LocalizationResolver();
    const metadata = { defaultLocale: "en", messages: { en: { title: "Diagnostics" }, ru: { title: "Диагностика" } } };
    expect(resolver.resolve(metadata, "ru-RU", "title", "fallback")).toBe("Диагностика");
    expect(resolver.resolve(metadata, "de-DE", "title", "fallback")).toBe("Diagnostics");
    expect(resolver.resolve(metadata, "de-DE", "missing", "fallback")).toBe("fallback");
  });
});
