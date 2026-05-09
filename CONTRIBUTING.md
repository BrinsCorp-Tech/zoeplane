# Contributing to ZoePlane

Thank you for your interest in contributing to ZoePlane. This document covers the
contribution workflow, branch conventions, license posture, and local prerequisites.

## License Posture

ZoePlane is released under the **Apache License 2.0**. By submitting a contribution
(pull request, patch, or otherwise), you agree that your contribution is made under
the same Apache 2.0 terms as the project (inbound = outbound). You retain copyright
over your contribution; you grant BrinsCorp-Tech and all downstream users the rights
described in the Apache 2.0 license.

## Code of Conduct

Be constructive, respectful, and collaborative. Maintainers reserve the right to
close issues or pull requests that are off-topic or violate these norms.

## Prerequisites

Before contributing code, ensure the following tools are installed:

| Tool         | Minimum Version       | Install                                  |
| ------------ | --------------------- | ---------------------------------------- |
| Bun          | 1.1.0                 | https://bun.sh                           |
| Node.js      | 20.0.0                | https://nodejs.org                       |
| Rust + Cargo | stable (edition 2021) | https://rustup.rs                        |
| Tauri CLI    | 2.x                   | `cargo install tauri-cli --version "^2"` |

**Rust is required** even for front-end-only changes because the pre-commit hook
runs `cargo fmt --check` over `src-tauri/`. If you do not have Rust installed,
`git commit` will fail locally. CI remains the enforcement backstop, but installing
Rust is strongly recommended to avoid blocked commits.

Install Rust: https://rustup.rs — follow the standard `rustup` install.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/BrinsCorp-Tech/zoeplane.git
cd zoeplane

# Install Node/Bun dependencies (also installs husky pre-commit hooks)
bun install

# Build design tokens first (required by the UI build)
bun run tokens:build

# Start the development server (Vite only — no Tauri shell)
bun run dev

# Start with the full Tauri shell (requires Rust toolchain)
bun run tauri
```

## Branch Convention

All work must happen on a feature branch. Never commit directly to `main` or `develop`.

Branch naming pattern:

```
feature/story-N.N-<short-kebab-description>
```

Examples:

- `feature/story-1.7-policy-bundle`
- `feature/story-2.3-session-ui`
- `fix/story-1.4-ci-matrix-eslint`

For hotfixes that do not map to a story, use:

```
fix/<short-kebab-description>
```

## Pull Request Workflow

1. Fork the repository (external contributors) or create a branch (org members).
2. Implement your change on a feature branch following the convention above.
3. Ensure all checks pass locally before opening a PR:
   ```bash
   bun run lint
   bun run typecheck
   bun run test
   cd src-tauri && cargo fmt --check && cargo clippy
   ```
4. Open a pull request against `develop` (not `main`).
5. Fill in the PR template — include the story number in the title.
6. CI must be green before the PR can be merged. Required checks:
   - ESLint + TypeScript typecheck
   - Vitest unit tests
   - Rust `cargo fmt --check` + `cargo clippy`
   - Scaffold-health gate

## Pre-Commit Hooks

Running `bun install` automatically installs the husky pre-commit hook via the
`prepare` script. The hook runs:

```
bunx lint-staged && (cd src-tauri && cargo fmt --check)
```

`lint-staged` applies ESLint + Prettier to staged TypeScript and JSON/Markdown/CSS
files. `cargo fmt --check` verifies Rust source formatting without modifying files
(non-zero exit blocks the commit).

If the hook fails:

- For TypeScript/JSON: run `bun run lint --fix` and `bunx prettier --write <files>`
- For Rust: run `cargo fmt` inside `src-tauri/` to auto-format, then re-stage

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): short description

Optional longer description. Reference story: Story N.N.
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

## Architecture Constraints

ZoePlane is a desktop-only Tauri 2.0 application. Contributions must not:

- Introduce Next.js, AWS Lambda, Cognito, or any server-side cloud infrastructure
- Add mobile / Expo / React Native targets
- Persist Claude session telemetry in SQLite (derived state only; source of truth is `~/.claude/`)
- Allow plugins to install hooks or write `settings.json` (hooks are user-authored only)
- Hardcode hex colour values in components (use design tokens from `packages/design-tokens`)
- Import `@tauri-apps/plugin-fs` directly in `src/**` (see FB-016 below)

### FB-016 — FS Allowlist Audit Logging

**Direct imports of `@tauri-apps/plugin-fs` are forbidden inside the `src/**` tree.\*\*

All filesystem access from the React UI must go through the IPC commands defined in
`src-tauri/src/commands/fs.rs`:

| IPC command     | Replaces                        |
| --------------- | ------------------------------- |
| `fs_read_file`  | `readFile` / `readBinaryFile`   |
| `fs_write_file` | `writeFile` / `writeBinaryFile` |
| `fs_read_dir`   | `readDir`                       |
| `fs_exists`     | `exists`                        |

Direct plugin imports bypass the FB-016 mandatory audit log — the wrapper commands
are the only point where allowlist violations are recorded (path + caller + timestamp).
This restriction is enforced by the `no-restricted-imports` ESLint rule in
`eslint.config.js` (applied to all `src/**` files).

The sidecar (`sidecar/`) uses `node:fs` natively; FB-016 scope does not reach it in
Sprint 1. That gap is tracked for a future story.

When in doubt about architecture, open a discussion issue before starting implementation.

## Security

Do not include secrets, API keys, or credentials in commits. Use Tauri's secure
secrets management or environment variables for sensitive configuration.

If you discover a security vulnerability, please report it privately to
security@brinscorp.tech rather than opening a public issue.
