---
name: broken-agent
description: This agent handles complex workflows
voice_id: abc123
{malformed: [unclosed bracket in middle of block
  deeply nested: {broken: structure
---

# Broken Agent

This fixture has a YAML block that fails both Tier 1 (raw parse) and Tier 2
(pre-processor wraps the description line but the {malformed block still breaks
the YAML parser). Tier 3 per-field regex extraction recovers name, description,
and voice_id from the allowlist. Result: mode=fallback, warnings=[front-matter-fallback-extraction].
