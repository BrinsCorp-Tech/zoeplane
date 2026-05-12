import type { Meta, StoryObj } from "@storybook/react";
import { Toaster, toast } from "./Toast";
import { Button } from "@/components/ui/Button/Button";

const meta: Meta = {
  title: "Foundation/Toast",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <>
        <Toaster />
        <Story />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj;

// ─── Variants ─────────────────────────────────────────────────────────────────

export const Variants: Story = {
  name: "Variants (info / success / warning / error / quarantine)",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.info("Project switched.", { description: "Active project is now security-review." })
        }
      >
        Info
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.success("Skill saved.", {
            description: "SKILL.md written to ~/.claude/skills/security-review/",
          })
        }
      >
        Success
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.warning("Stale CLI fingerprint.", {
            description: "Re-run fingerprint scan to update.",
          })
        }
      >
        Warning
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.error("Could not save SKILL.md.", { description: "File system permission denied." })
        }
      >
        Error
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.quarantine("Hook quarantined: PreToolUse → bash:rm", {
            description: "External edit detected and evaluator flagged 2 criticals.",
          })
        }
      >
        Quarantine
      </Button>
    </div>
  ),
};

// ─── WithAction ───────────────────────────────────────────────────────────────

export const WithAction: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.success("Skill saved.", {
            action: {
              label: "Undo",
              onClick: () => console.log("Undo clicked"),
            },
          })
        }
      >
        Success + Undo
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.error("Could not save SKILL.md.", {
            description: "File system permission denied.",
            action: {
              label: "Reveal in Finder",
              onClick: () => console.log("Reveal in Finder clicked"),
            },
          })
        }
      >
        Error + Retry (persistent)
      </Button>
    </div>
  ),
};

// ─── WithDescription ──────────────────────────────────────────────────────────

export const WithDescription: Story = {
  render: () => (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        toast.info("5 hooks discovered.", {
          description: "All hooks passed the safety evaluator.",
        })
      }
    >
      With description
    </Button>
  ),
};

// ─── Stacked ─────────────────────────────────────────────────────────────────

export const Stacked: Story = {
  name: "Stacked (3 toasts + overflow pill)",
  render: () => (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        toast.success("Skill saved.");
        toast.info("Project switched.");
        toast.warning("Stale CLI fingerprint.");
        toast.error("Sidecar disconnected.");
      }}
    >
      Trigger 4 toasts
    </Button>
  ),
};

// ─── PersistentError ─────────────────────────────────────────────────────────

export const PersistentError: Story = {
  name: "PersistentError (no auto-dismiss)",
  render: () => (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.error("Could not sync hooks.", {
            description: "Network unavailable. Retrying…",
            duration: Infinity,
          })
        }
      >
        Persistent error
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.quarantine("Hook quarantined: SessionStart → node:path", {
            description: "Review required before hook can fire.",
            action: { label: "Review", onClick: () => console.log("Review") },
          })
        }
      >
        Persistent quarantine
      </Button>
    </div>
  ),
};

// ─── ReducedMotion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  name: "ReducedMotion (A-03/A-04 — fade only)",
  decorators: [
    (Story) => (
      <div className="prefers-reduced-motion">
        <Toaster />
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        toast.success("Reduced motion toast.", {
          description: "Entrance and exit fade only — no slide.",
        })
      }
    >
      Trigger (reduced motion)
    </Button>
  ),
};
