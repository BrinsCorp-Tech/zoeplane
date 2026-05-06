// ZoePlane — Utility functions
// These utilities are the canonical helpers consumed across the UI codebase.

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — Class name merger.
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution).
 * This is the standard ZoePlane pattern for composing Tailwind classes.
 *
 * Usage:
 *   cn("base-class", condition && "conditional-class", props.className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
