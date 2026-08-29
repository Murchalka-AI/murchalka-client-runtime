import type { LocalizationMetadata } from "../Protocol/LocalizationMetadata.js";

/** Resolves signed extension messages with deterministic locale fallback. */
export class LocalizationResolver {
  /** Resolves one message for the requested locale or returns the supplied safe fallback. */
  public resolve(metadata: LocalizationMetadata, locale: string, key: string, fallback: string): string {
    const candidates = [locale, locale.split("-")[0], metadata.defaultLocale].filter((value, index, all) => value !== undefined && all.indexOf(value) === index);
    for (const candidate of candidates) {
      const message = metadata.messages[candidate!]?.[key];
      if (typeof message === "string" && message.length <= 4096) return message;
    }
    return fallback;
  }
}
