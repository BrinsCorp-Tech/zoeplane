import type { Preview } from "@storybook/react";
import "../src/styles/globals.css"; // brings in tokens.css + typography.css + Tailwind cascade

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Light / Dark / System",
      defaultValue: "system",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
    reducedMotion: {
      name: "Reduced motion",
      description: "Force prefers-reduced-motion: reduce",
      defaultValue: "default",
      toolbar: {
        icon: "speed",
        items: [
          { value: "default", title: "Default" },
          { value: "reduce", title: "Reduce" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme as "light" | "dark" | "system";
      if (theme === "system") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.dataset.theme = theme;
      }

      const rm = ctx.globals.reducedMotion as "default" | "reduce";
      document.documentElement.classList.toggle("prefers-reduced-motion", rm === "reduce");

      return Story();
    },
  ],
};

export default preview;
