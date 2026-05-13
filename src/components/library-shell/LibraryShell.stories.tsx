/**
 * LibraryShell stories — Story 2.11 AC #10 matrix.
 *
 * Matrix: 6 consumer modes (Skills / Agents / Commands / Hooks / Teams / Workflows)
 * × state axis (Empty / Loading / Error / FilteredEmpty / ScopeFiltered / Populated)
 * × 2 themes (light / dark) = 12+ stories.
 *
 * Mock data: all mock types and fixtures are Storybook-internal — NOT shipped
 * as real components. The real SkillCard, AgentCard, etc. are Sprint 3+ deliverables.
 * Mocks here serve only to validate the LibraryShell generic + layout contract.
 *
 * Consumer-mode stories all use the Skill mode as the canonical shape for state-
 * axis stories (Empty / Loading / Error / FilteredEmpty / ScopeFiltered).
 * The 6 consumer-mode stories demonstrate each library's tab vocabulary +
 * searchPredicate shape.
 *
 * @see docs/design/components/LibraryShell-spec.md §8 Usage Examples
 */
import type { Meta, StoryObj } from "@storybook/react";
import { LibraryShell } from "./LibraryShell";
import type { LibraryShellProps } from "./LibraryShell";

// ─── Mock data types (Storybook-internal — NOT shipped components) ─────────────

interface MockSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  scope: "user" | "project";
}

interface MockAgent {
  id: string;
  name: string;
  archetype: string;
  scope: "user" | "project";
}

interface MockCommand {
  id: string;
  name: string;
  scope: "global" | "project";
}

interface MockHook {
  id: string;
  command: string;
  event: string;
  scope: "user" | "project" | "local";
}

interface MockTeam {
  id: string;
  name: string;
  memberCount: number;
}

interface MockWorkflow {
  id: string;
  name: string;
  scope: "project" | "user";
}

// ─── Mock fixtures ────────────────────────────────────────────────────────────

const MOCK_SKILLS: MockSkill[] = [
  {
    id: "s1",
    name: "code-review",
    description: "Systematic code quality checks with structured feedback",
    tags: ["quality", "review"],
    scope: "user",
  },
  {
    id: "s2",
    name: "test-generator",
    description: "Generate unit + integration tests from source code",
    tags: ["testing", "automation"],
    scope: "project",
  },
  {
    id: "s3",
    name: "doc-writer",
    description: "Author technical documentation from implementation",
    tags: ["docs", "writing"],
    scope: "user",
  },
  {
    id: "s4",
    name: "dependency-audit",
    description: "Scan and report on outdated or vulnerable dependencies",
    tags: ["security", "maintenance"],
    scope: "project",
  },
  {
    id: "s5",
    name: "refactor-assist",
    description: "Identify and apply safe refactoring opportunities",
    tags: ["quality", "refactoring"],
    scope: "user",
  },
  {
    id: "s6",
    name: "commit-message",
    description: "Generate conventional commit messages from diff",
    tags: ["git", "workflow"],
    scope: "user",
  },
];

const MOCK_AGENTS: MockAgent[] = [
  { id: "a1", name: "architect", archetype: "Technical Lead", scope: "user" },
  { id: "a2", name: "sprint-programmer", archetype: "Efficient Craftsman", scope: "user" },
  { id: "a3", name: "code-reviewer", archetype: "Quality Guardian", scope: "project" },
  { id: "a4", name: "research-analyst", archetype: "Knowledge Synthesizer", scope: "user" },
];

const MOCK_COMMANDS: MockCommand[] = [
  { id: "c1", name: "dev-workflow", scope: "global" },
  { id: "c2", name: "story-from-epic", scope: "global" },
  { id: "c3", name: "code-audit", scope: "project" },
  { id: "c4", name: "test-run", scope: "project" },
];

const MOCK_HOOKS: MockHook[] = [
  { id: "h1", command: "notification", event: "PostToolUse", scope: "user" },
  { id: "h2", command: "lint-check", event: "PreToolUse", scope: "project" },
  { id: "h3", command: "log-session", event: "Stop", scope: "local" },
];

const MOCK_TEAMS: MockTeam[] = [
  { id: "t1", name: "Core Dev", memberCount: 4 },
  { id: "t2", name: "Design Review", memberCount: 3 },
];

const MOCK_WORKFLOWS: MockWorkflow[] = [
  { id: "w1", name: "sprint-delivery", scope: "project" },
  { id: "w2", name: "code-ship", scope: "user" },
];

// ─── Mock card renderers (Storybook-internal — NOT exported) ──────────────────

function MockSkillCard({ skill }: { skill: MockSkill }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "12px",
        background: "var(--color-surface)",
        height: "140px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "14px" }}>{skill.name}</div>
      <div style={{ fontSize: "12px", color: "var(--color-foreground-muted)", flex: 1 }}>
        {skill.description}
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        {skill.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "9999px",
              background: "var(--color-surface-muted)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div style={{ fontSize: "11px", color: "var(--color-foreground-subtle)" }}>
        {skill.scope} scope
      </div>
    </div>
  );
}

function MockAgentCard({ agent }: { agent: MockAgent }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "12px",
        background: "var(--color-surface)",
        height: "140px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "14px" }}>{agent.name}</div>
      <div style={{ fontSize: "12px", color: "var(--color-foreground-muted)" }}>
        {agent.archetype}
      </div>
      <div style={{ marginTop: "auto", fontSize: "11px", color: "var(--color-foreground-subtle)" }}>
        {agent.scope} scope
      </div>
    </div>
  );
}

function MockCommandCard({ command }: { command: MockCommand }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "12px",
        background: "var(--color-surface)",
        height: "140px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "14px" }}>/{command.name}</div>
      <div
        style={{
          marginTop: "auto",
          fontSize: "11px",
          color: "var(--color-foreground-subtle)",
        }}
      >
        {command.scope}
      </div>
    </div>
  );
}

function MockHookCard({ hook }: { hook: MockHook }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "12px",
        background: "var(--color-surface)",
        height: "140px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "14px" }}>{hook.command}</div>
      <div style={{ fontSize: "12px", color: "var(--color-foreground-muted)" }}>{hook.event}</div>
      <div style={{ marginTop: "auto", fontSize: "11px", color: "var(--color-foreground-subtle)" }}>
        {hook.scope}
      </div>
    </div>
  );
}

function MockTeamCard({ team }: { team: MockTeam }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "12px",
        background: "var(--color-surface)",
        height: "140px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "14px" }}>{team.name}</div>
      <div style={{ fontSize: "12px", color: "var(--color-foreground-muted)" }}>
        {team.memberCount} members
      </div>
    </div>
  );
}

function MockWorkflowCard({ workflow }: { workflow: MockWorkflow }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "12px",
        background: "var(--color-surface)",
        height: "140px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "14px" }}>{workflow.name}</div>
      <div style={{ marginTop: "auto", fontSize: "11px", color: "var(--color-foreground-subtle)" }}>
        {workflow.scope}
      </div>
    </div>
  );
}

// ─── Simple empty / error slot renderers ──────────────────────────────────────

function SimpleEmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "48px",
        textAlign: "center",
        color: "var(--color-foreground-muted)",
        border: "2px dashed var(--color-border)",
        borderRadius: "8px",
      }}
    >
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>🗂</div>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "12px", marginTop: "4px" }}>Add items to get started.</div>
    </div>
  );
}

function SimpleErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        padding: "32px",
        textAlign: "center",
        color: "var(--color-foreground-danger)",
        border: "1px solid var(--color-border-danger)",
        borderRadius: "8px",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "8px" }}>Failed to load</div>
      <button
        onClick={onRetry}
        style={{
          padding: "6px 16px",
          borderRadius: "6px",
          border: "1px solid var(--color-border)",
          cursor: "pointer",
          background: "var(--color-surface)",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── Storybook meta ───────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Application/LibraryShell",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

// ─── TYPE: Story helper (typed separately since LibraryShell is generic) ───────

type SkillShellStory = StoryObj<LibraryShellProps<MockSkill>>;

// ─── STATE AXIS — Skill mode as canonical consumer ───────────────────────────

/**
 * State: Populated — the canonical success state with a full card grid.
 * Scope tabs: All / User / Project. Search: enabled.
 */
export const PopulatedSkillsLight: SkillShellStory = {
  name: "Skills — Populated (light)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "500px" }}>
      <LibraryShell<MockSkill>
        items={MOCK_SKILLS}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        searchPlaceholder="Search skills..."
        searchPredicate={(skill, term) =>
          skill.name.toLowerCase().includes(term.toLowerCase()) ||
          skill.description.toLowerCase().includes(term.toLowerCase()) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(term.toLowerCase()))
        }
        scopeTabs={{
          defaultValue: "all",
          tabsAriaLabel: "Skill scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (s) => s.scope === "user" },
            { value: "project", label: "Project", predicate: (s) => s.scope === "project" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

export const PopulatedSkillsDark: SkillShellStory = {
  name: "Skills — Populated (dark)",
  render: () => (
    <div data-theme="dark" className="bg-background p-4" style={{ minHeight: "500px" }}>
      <LibraryShell<MockSkill>
        items={MOCK_SKILLS}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        searchPlaceholder="Search skills..."
        searchPredicate={(skill, term) =>
          skill.name.toLowerCase().includes(term.toLowerCase()) ||
          skill.description.toLowerCase().includes(term.toLowerCase()) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(term.toLowerCase()))
        }
        scopeTabs={{
          defaultValue: "all",
          tabsAriaLabel: "Skill scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (s) => s.scope === "user" },
            { value: "project", label: "Project", predicate: (s) => s.scope === "project" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/**
 * State: Loading — fixed C2 skeleton grid of 12 CardSkeletons.
 * Header renders normally (from cached state per spec).
 */
export const LoadingState: SkillShellStory = {
  name: "Skills — Loading (C2 skeleton grid)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "500px" }}>
      <LibraryShell<MockSkill>
        items={[]}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        loading={true}
        searchPlaceholder="Search skills..."
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/**
 * State: Empty — items=[] and loading=false. Distinct from loading (no shimmer).
 */
export const EmptyState: SkillShellStory = {
  name: "Skills — Empty (distinct from loading, no shimmer)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={[]}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        loading={false}
        searchPlaceholder="Search skills..."
        emptyState={<SimpleEmptyState label="Your skill library is empty" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/**
 * State: Error — error prop non-null. errorState slot rendered.
 * Header remains visible per spec §3 ERROR state.
 */
export const ErrorState: SkillShellStory = {
  name: "Skills — Error (retry affordance via errorState slot)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={[]}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        error={new Error("Failed to read ~/.claude/skills/")}
        searchPlaceholder="Search skills..."
        scopeTabs={{
          defaultValue: "all",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (s) => s.scope === "user" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => alert("Retry clicked")} />}
      />
    </div>
  ),
};

/**
 * State: FilteredEmpty — search term yields zero results.
 * Reuses the EMPTY render path (emptyState slot) per spec §3.2.
 * (Storybook: pre-set the search term via state in the render wrapper.)
 */
export const FilteredEmpty: SkillShellStory = {
  name: "Skills — FilteredEmpty (search returns zero — reuses emptyState slot)",
  render: () => {
    // Simulates the state where ALL items fail the search predicate.
    // We achieve this by passing an empty items array (the shell cannot distinguish
    // "originally empty" from "filter-empty" — per spec §3.2 this is correct behavior).
    return (
      <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
        <LibraryShell<MockSkill>
          items={[]}
          ariaLabel="Skills library"
          renderCard={(skill) => <MockSkillCard skill={skill} />}
          loading={false}
          searchPlaceholder="Search skills..."
          emptyState={
            <div
              style={{
                padding: "48px",
                textAlign: "center",
                color: "var(--color-foreground-muted)",
                border: "2px dashed var(--color-border)",
                borderRadius: "8px",
              }}
            >
              <div style={{ fontWeight: 600 }}>No skills match &quot;zzzzzz&quot;</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                Consumers can detect filtered-empty vs originally-empty via closure.
              </div>
            </div>
          }
          errorState={<SimpleErrorState onRetry={() => {}} />}
        />
      </div>
    );
  },
};

/**
 * State: FilteredEmpty (via predicate) — exercises the filter-pipeline path to empty.
 *
 * Unlike FilteredEmpty (which passes items=[] to simulate empty), this story passes
 * the full MOCK_SKILLS array and provides a scope tab predicate that returns false for
 * every item. The shell's filter pipeline runs, produces filteredItems.length === 0,
 * and renders the emptyState slot — verifying the real filtered-empty code path.
 *
 * Both FilteredEmpty stories have value: FilteredEmpty tests originally-empty input;
 * FilteredEmptyViaPredicate tests filter-pipeline-yields-empty.
 */
export const FilteredEmptyViaPredicate: SkillShellStory = {
  name: "Skills — FilteredEmpty via predicate (filter pipeline yields zero)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={MOCK_SKILLS}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        searchPlaceholder="Search skills..."
        searchPredicate={(skill, term) => skill.name.toLowerCase().includes(term.toLowerCase())}
        scopeTabs={{
          defaultValue: "impossible",
          tabsAriaLabel: "Skill scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            {
              value: "impossible",
              label: "None",
              predicate: () => false, // always false — every item filtered out
            },
          ],
        }}
        emptyState={
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "var(--color-foreground-muted)",
              border: "2px dashed var(--color-border)",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontWeight: 600 }}>No skills match the active filter</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              The filter pipeline returned zero items — same emptyState slot, different arrival
              path.
            </div>
          </div>
        }
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/**
 * State: ScopeFiltered — scope tab active (shows only Project skills).
 */
export const ScopeFiltered: SkillShellStory = {
  name: "Skills — ScopeFiltered (Project tab active)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={MOCK_SKILLS}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        searchPlaceholder="Search skills..."
        searchPredicate={(skill, term) => skill.name.toLowerCase().includes(term.toLowerCase())}
        scopeTabs={{
          defaultValue: "project",
          tabsAriaLabel: "Skill scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (s) => s.scope === "user" },
            { value: "project", label: "Project", predicate: (s) => s.scope === "project" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No project skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

// ─── 6 CONSUMER MODE STORIES ──────────────────────────────────────────────────

/** Consumer mode: Agents Library */
export const AgentsLibrary = {
  name: "Agents — Populated (6 consumer modes matrix)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockAgent>
        items={MOCK_AGENTS}
        ariaLabel="Agents library"
        renderCard={(agent) => <MockAgentCard agent={agent} />}
        searchPlaceholder="Search agents..."
        searchPredicate={(agent, term) =>
          agent.name.toLowerCase().includes(term.toLowerCase()) ||
          agent.archetype.toLowerCase().includes(term.toLowerCase())
        }
        scopeTabs={{
          defaultValue: "all",
          tabsAriaLabel: "Agent scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (a) => a.scope === "user" },
            { value: "project", label: "Project", predicate: (a) => a.scope === "project" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No agents found in ~/.claude/agents/" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Consumer mode: Commands Library */
export const CommandsLibrary = {
  name: "Commands — Populated (6 consumer modes matrix)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockCommand>
        items={MOCK_COMMANDS}
        ariaLabel="Commands library"
        renderCard={(cmd) => <MockCommandCard command={cmd} />}
        searchPlaceholder="Search commands..."
        searchPredicate={(c, term) => c.name.includes(term)}
        scopeTabs={{
          defaultValue: "all",
          tabsAriaLabel: "Command scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "global", label: "Global", predicate: (c) => c.scope === "global" },
            { value: "project", label: "Project", predicate: (c) => c.scope === "project" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No commands yet" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Consumer mode: Hooks Library */
export const HooksLibrary = {
  name: "Hooks — Populated (6 consumer modes matrix)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockHook>
        items={MOCK_HOOKS}
        ariaLabel="Hooks library"
        renderCard={(hook) => <MockHookCard hook={hook} />}
        searchPlaceholder="Search command..."
        searchPredicate={(hook, term) => hook.command.toLowerCase().includes(term.toLowerCase())}
        scopeTabs={{
          defaultValue: "all",
          tabsAriaLabel: "Hook scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (h) => h.scope === "user" },
            { value: "project", label: "Project", predicate: (h) => h.scope === "project" },
            { value: "local", label: "Local", predicate: (h) => h.scope === "local" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No hooks installed" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Consumer mode: Teams Library (no search predicate — search input still shown) */
export const TeamsLibrary = {
  name: "Teams — Populated (6 consumer modes matrix)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockTeam>
        items={MOCK_TEAMS}
        ariaLabel="Teams library"
        renderCard={(team) => <MockTeamCard team={team} />}
        searchPlaceholder="Search teams..."
        searchPredicate={(team, term) => team.name.toLowerCase().includes(term.toLowerCase())}
        emptyState={<SimpleEmptyState label="No teams composed yet" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Consumer mode: Workflows Library */
export const WorkflowsLibrary = {
  name: "Workflows — Populated (6 consumer modes matrix)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockWorkflow>
        items={MOCK_WORKFLOWS}
        ariaLabel="Workflows library"
        renderCard={(w) => <MockWorkflowCard workflow={w} />}
        searchPlaceholder="Search workflows..."
        searchPredicate={(w, term) => w.name.toLowerCase().includes(term.toLowerCase())}
        scopeTabs={{
          defaultValue: "all",
          tabsAriaLabel: "Workflow scope",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "project", label: "Project", predicate: (w) => w.scope === "project" },
            { value: "user", label: "User", predicate: (w) => w.scope === "user" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No workflows yet" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Consumer mode: Skills Library dark theme — closing out the 6×2 matrix */
export const SkillsLibraryDarkMatrix = {
  name: "Skills — Populated (dark theme — 6-mode matrix closure)",
  render: () => (
    <div data-theme="dark" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={MOCK_SKILLS}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        searchPlaceholder="Search skills..."
        searchPredicate={(skill, term) => skill.name.toLowerCase().includes(term.toLowerCase())}
        scopeTabs={{
          defaultValue: "all",
          tabs: [
            { value: "all", label: "All", predicate: () => true },
            { value: "user", label: "User", predicate: (s) => s.scope === "user" },
            { value: "project", label: "Project", predicate: (s) => s.scope === "project" },
          ],
        }}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** No-chrome shell — no search, no tabs, no filters. Valid edge case per spec §1. */
export const NoChrome = {
  name: "Skills — No chrome (no search, no tabs — valid edge case)",
  render: () => (
    <div data-theme="light" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={MOCK_SKILLS}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Error state — dark theme */
export const ErrorStateDark = {
  name: "Skills — Error (dark theme)",
  render: () => (
    <div data-theme="dark" className="bg-background p-4" style={{ minHeight: "400px" }}>
      <LibraryShell<MockSkill>
        items={[]}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        error={new Error("Network error")}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};

/** Loading state — dark theme */
export const LoadingStateDark = {
  name: "Skills — Loading (dark theme)",
  render: () => (
    <div data-theme="dark" className="bg-background p-4" style={{ minHeight: "500px" }}>
      <LibraryShell<MockSkill>
        items={[]}
        ariaLabel="Skills library"
        renderCard={(skill) => <MockSkillCard skill={skill} />}
        loading={true}
        emptyState={<SimpleEmptyState label="No skills found" />}
        errorState={<SimpleErrorState onRetry={() => {}} />}
      />
    </div>
  ),
};
