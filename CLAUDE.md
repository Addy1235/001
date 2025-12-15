# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vanilla JavaScript flashcard application for language learning (German, Russian, English). Single-page app with no build tools or frameworks - just `index.html`, `app.js`, and `styles.css`.

## Development

**Run locally:** Open `index.html` directly in a browser (no server needed).

**Tech stack:** HTML5, CSS3, vanilla JavaScript (ES6+). Uses localStorage for data persistence, Web Speech API for TTS.

## Architecture

Single `FlashcardApp` class (~950 lines) handles all functionality:
- **Data structure:** `{ folders: { german/russian/english: { name, flag, sets: [...] } } }`
- **Navigation:** Library (folders) → Folder (sets) → Set (cards + study modes)
- **Study modes:** Flashcards, Learn (multiple choice), Test (typed answers), Match (tile matching)
- **Progress tracking:** Cards have `mastery` status: "not-started", "learning", "mastered"

Key methods:
- `showLibrary()`, `showFolder()`, `showSet()` - view navigation
- `switchMode()` - toggle between study modes
- `saveCard()`, `deleteCard()` - CRUD operations
- `markCard()` - progress tracking
- `speak()` - TTS with language-specific voices

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/workflows/primary-workflow.md`
- Development rules: `./.claude/workflows/development-rules.md`
- Orchestration protocols: `./.claude/workflows/orchestration-protocol.md`
- Documentation management: `./.claude/workflows/documentation-management.md`
- And other workflows: `./.claude/workflows/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/workflows/development-rules.md` file.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.
**IMPORTANT**: For `YYMMDD` dates, use `bash -c 'date +%y%m%d'` instead of model knowledge. Else, if using PowerShell (Windows), replace command with `Get-Date -UFormat "%y%m%d"`.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

## Plan Templates

Implementation plans go in `./plans/` directory. Use templates from `./plans/templates/`:
- `feature-implementation-template.md` - new features
- `bug-fix-template.md` - bug fixes
- `refactor-template.md` - code refactoring

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*
