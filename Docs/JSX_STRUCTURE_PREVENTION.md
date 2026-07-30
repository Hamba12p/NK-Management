# JSX Structure & Syntax Error Prevention Guide

## Issue Summary
The volunteers page had a premature closing `</div>` tag that broke the JSX structure. This was a common error that can be caught and prevented.

## Root Causes
1. **Duplicate closing tags** - Tags closed before all content is rendered
2. **Unmatched parentheses** - Conditional rendering blocks not properly closed
3. **Syntax highlighting gaps** - Editor visual cues missed the issue

## Prevention Measures Implemented

### 1. ESLint Configuration (`.eslintrc.json`)
- Enables JSX validation rules
- Catches common React pattern mistakes
- Validates key props and duplicate props
- Detects unused variables and undefined references

### 2. Enhanced npm Scripts
Added to `package.json`:
```bash
npm run lint        # Check for ESLint violations
npm run lint:fix    # Auto-fix ESLint issues
npm run type-check  # Validate TypeScript types
npm run check       # Run all checks
```

## Before Committing

**Always run these checks:**
```bash
npm run check
```

This will catch:
- JSX syntax errors
- Unmatched opening/closing tags
- TypeScript type issues
- Unused imports and variables

## Best Practices for JSX

### ✅ DO:
```tsx
return (
  <div>
    <Header />
    {condition && (
      <Form />
    )}
    <Content />
  </div>  // One closing tag at the end
);
```

### ❌ DON'T:
```tsx
return (
  <div>
    <Header />
    </div>  // ❌ Premature close!
    {condition && (
      <Form />
    )}
  </div>
);
```

### Quick Checklist for Code Review
- [ ] Every `<` has a matching `>`
- [ ] Every `{` in JSX has a matching `}`
- [ ] All opening tags have closing tags
- [ ] No premature closing tags
- [ ] Conditional renders properly wrapped in `{}`
- [ ] Fragments `<>...</>` used for multiple elements

## IDE Tips
- Enable bracket matching highlighting in VS Code
- Use Prettier for auto-formatting (recommended to add)
- Use ESLint extension for inline error reporting

## Testing Changes
After making changes to any page:
1. Run `npm run check` ✓
2. Refresh browser
3. Verify page renders correctly

## Common Patterns That Fail
```tsx
// ❌ Missing div close
<div>{items.map(...)}</div>
<OtherComponent />

// ✅ Correct structure  
<div>
  {items.map(...)}
</div>
<OtherComponent />
```

## Future Implementation
Consider adding:
- Pre-commit hooks via `husky` + `lint-staged`
- Automated testing for component rendering
- CI/CD pipeline checks
