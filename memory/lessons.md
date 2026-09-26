# Lessons Learned

## Bugs & Pitfalls

- Zod versions differ: frontend = v3, backend = v4. Check before using Zod APIs.
- .cursor/rules/ai-workflow.mdc references .ai/ directory — doesn't exist. Rules live in .cursor/rules/.
- framer-motion ~140KB in critical bundle — must use lazy imports
- App.css (42 lines, Vite boilerplate) is dead code — not imported anywhere

## Coverage

- Coverage exclusions are extensive — check sonar-project.properties and jest.config.js before adding tests
- make test starts dedicated test DB, not production one

<!-- Add entries here as you discover them -->
