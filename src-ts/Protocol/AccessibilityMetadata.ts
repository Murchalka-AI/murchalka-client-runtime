/** Defines the mandatory accessible name and optional announcement behavior. */
export interface AccessibilityMetadata {
  readonly label: string;
  readonly description?: string;
  readonly liveRegion?: "off" | "polite" | "assertive";
}
