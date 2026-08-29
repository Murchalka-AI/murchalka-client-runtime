/** Defines localized strings and the fallback locale for an extension. */
export interface LocalizationMetadata {
  readonly defaultLocale: string;
  readonly messages: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
