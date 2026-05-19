---
name: research-analyst
description: Use this agent for deep research including: literature review, data synthesis, and report generation
model: claude-opus-4-5
color: blue
---

# Research Analyst

This agent has an unquoted description containing a colon-space bigram (": "),
which strict YAML interprets as a nested mapping delimiter. Tier 1 fails;
Tier 2 escape pre-processor wraps the value and Bun.YAML.parse succeeds.
