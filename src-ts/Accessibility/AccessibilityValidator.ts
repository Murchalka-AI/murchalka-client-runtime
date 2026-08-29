import type { ClientExtension } from "../Protocol/ClientExtension.js";

/** Enforces mandatory accessibility metadata before an extension can activate. */
export class AccessibilityValidator {
  /** Rejects an extension without a bounded accessible name and fallback locale. */
  public validate(extension: ClientExtension): void {
    const label = extension.accessibility.label.trim();
    if (label.length === 0 || label.length > 160) throw new Error("Extension accessibility label is required and limited to 160 characters.");
    if (extension.localization.defaultLocale.trim().length === 0) throw new Error("Extension default locale is required.");
    if (extension.localization.messages[extension.localization.defaultLocale] === undefined) {
      throw new Error("Extension localization must include its default locale.");
    }
    if (extension.fallbackComponent.trim().length === 0) throw new Error("Extension fallback component is required.");
  }
}
