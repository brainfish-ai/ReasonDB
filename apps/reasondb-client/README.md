# ReasonDB Desktop Client

A modern, beautiful desktop application for ReasonDB - built with Tauri 2.0, React 19, and TypeScript.

## Features

- 🔌 **Connection Management** - Connect to multiple ReasonDB instances
- 📝 **Query Editor** - Monaco-based editor with RQL syntax highlighting
- 🔍 **Data Browser** - Explore tables, documents, and nodes
- 📊 **Results Viewer** - Table, JSON, and tree visualizations
- 🤖 **AI-Powered Search** - Natural language search and REASON queries
- 🔬 **LLM Tracing** - Visualize reasoning flows, debug prompts, track costs
- 📦 **Import/Export** - JSON, CSV, and backup support
- 🎨 **Beautiful UI** - Dark/light themes with Catppuccin colors

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Tauri 2.0](https://v2.tauri.app/) | Desktop framework |
| [React 19](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS 4](https://tailwindcss.com/) | Styling |
| [Phosphor Icons](https://phosphoricons.com/) | Icon library |
| [Radix UI](https://www.radix-ui.com/) | Accessible components |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management |

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Tauri CLI: `cargo install tauri-cli`

### Setup

```bash
# Install dependencies
npm install

# Run development server (frontend only)
npm run dev

# Run Tauri development
npm run tauri dev

# Build for production
npm run tauri build
```

### Testing

> ⚠️ **Tests are mandatory.** All PRs require passing tests with minimum coverage.

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run Rust tests
cd src-tauri && cargo test
```

## Project Structure

```
apps/reasondb-client/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # Tauri commands
│   │   ├── api/         # ReasonDB API client
│   │   ├── db/          # Local SQLite storage
│   │   └── models/      # Data models
│   └── Cargo.toml
├── src/                 # React frontend
│   ├── components/      # UI components
│   ├── hooks/           # Custom hooks
│   ├── stores/          # Zustand stores
│   └── lib/             # Utilities
├── package.json
└── PLAN.md              # Detailed development plan
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Enter` | Execute query |
| `Cmd/Ctrl+N` | New query tab |
| `Cmd/Ctrl+W` | Close tab |
| `Cmd/Ctrl+S` | Save query |
| `Cmd/Ctrl+K` | Quick switch connection |
| `Cmd/Ctrl+P` | Command palette |
| `Cmd/Ctrl+B` | Toggle sidebar |

## License

MIT OR Apache-2.0
