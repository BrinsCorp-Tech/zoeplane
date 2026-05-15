// ZoePlane — PostCSS configuration (single source of truth at project root).
// Vite discovery: main app (root: "src/") walks upward and finds this file;
// Storybook (CWD = project root) resolves it directly. Story 2.22 removed
// the duplicate src/postcss.config.js — do not re-add it.

export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
