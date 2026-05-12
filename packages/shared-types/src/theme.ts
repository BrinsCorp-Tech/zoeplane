/**
 * @zoeplane/shared-types — Theme contract
 *
 * Defines the THEME_CHANGE IPC message and related theme types.
 *
 * Design distinction:
 *   - `ThemePreference` — the user's stored preference, including "system" (the default).
 *     Stored in UserPreferences.theme (SQLite) and in localStorage ("zoeplane:theme").
 *   - `ResolvedTheme` — the actual rendered theme: always "light" or "dark".
 *     Derived by ThemeProvider resolving "system" via matchMedia.
 *   - `ThemeChangeMessage` — the IPC envelope sent to plugins when the rendered theme
 *     changes. Plugins always receive a resolved value ("light" | "dark"), never "system",
 *     because plugins render UI and need a concrete mode to apply.
 *
 * ThemeProvider resolves "system" → "light" | "dark" via
 * `window.matchMedia("(prefers-color-scheme: dark)")` before dispatching
 * THEME_CHANGE messages or setting `<html data-theme="...">`.
 */

/** The user's stored theme preference. "system" defers to the OS preference. */
export type ThemePreference = "system" | "light" | "dark";

/**
 * The resolved (rendered) theme. Always "light" or "dark" — never "system".
 * This is what gets written to `<html data-theme="...">` and dispatched to plugins.
 */
export type ResolvedTheme = "light" | "dark";

/**
 * IPC message sent to plugins when the active theme changes.
 *
 * Plugins subscribe to this message via the Plugin SDK event bus.
 * The theme value is always resolved — plugins never see "system".
 *
 * Example:
 * ```ts
 * pluginBus.on("THEME_CHANGE", (msg: ThemeChangeMessage) => {
 *   applyTheme(msg.theme); // "light" | "dark"
 * });
 * ```
 */
export interface ThemeChangeMessage {
  type: "THEME_CHANGE";
  /** The resolved theme — "light" or "dark". Never "system". */
  theme: ResolvedTheme;
}
