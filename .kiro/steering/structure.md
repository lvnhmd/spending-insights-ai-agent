# Project Structure

This document outlines the organization and folder structure conventions for the project.

## Root Directory
```
.
├── .kiro/              # Kiro configuration and steering rules
│   └── steering/       # AI assistant guidance documents
├── src/                # Source code (when applicable)
├── tests/              # Test files
├── docs/               # Documentation
├── config/             # Configuration files
└── README.md           # Project overview and setup instructions
```

## Folder Conventions

### Source Code (`src/`)
- Organize by feature or module when possible
- Keep related files together
- Use clear, descriptive folder names
- Separate concerns (models, views, controllers, utilities)

### Tests (`tests/`)
- Mirror the source code structure
- Use descriptive test file names
- Group related tests together
- Include integration and unit tests

### Documentation (`docs/`)
- API documentation
- Architecture decisions
- Setup and deployment guides
- User documentation

### Configuration (`config/`)
- Environment-specific configurations
- Build configurations
- Tool configurations (linting, formatting, etc.)

## File Naming Conventions
- Use consistent naming patterns
- Prefer lowercase with hyphens or underscores
- Make names descriptive and meaningful
- Follow language-specific conventions

## Organization Principles
- Keep related functionality together
- Minimize deep nesting when possible
- Use clear separation between different concerns
- Maintain consistent structure across similar components