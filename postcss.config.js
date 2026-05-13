// ZoePlane — PostCSS configuration (project root).
// Required because Storybook runs Vite with the project root as its CWD,
// so Vite's PostCSS discovery walks upward from project root and needs the
// config HERE — not at src/postcss.config.js. The main app dev server
// (bun run dev, which CDs into src/) still finds src/postcss.config.js.
//
// Both configs are intentionally identical. Consolidate to one location
// in a future cleanup story.

export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
