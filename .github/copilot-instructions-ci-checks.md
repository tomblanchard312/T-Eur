# CI Checks for Copilot Instruction Integrity

These checks ensure Copilot guardrails cannot be bypassed.

## Enforced Rules
- copilot-instructions.md must exist
- No weakening language such as "best effort" or "optional"
- No TODO or placeholder language allowed
- File changes require security review approval

## Example GitHub Actions Rule
```yaml
- name: Enforce Copilot Instructions Integrity
  run: |
    set -e
    test -f .github/copilot-instructions.md
    grep -i "todo\|placeholder\|optional" .github/copilot-instructions.md && exit 1 || true
```
