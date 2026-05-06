// ZoePlane — PostCSS configuration
// Tailwind v4 ships its own PostCSS plugin; autoprefixer is included for
// any CSS properties that need vendor prefixes on older WebKit/Chromium.

export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
