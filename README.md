---
created: 2026-01-08T16:22:28
---

# Bidirectional Properties

Automatically sync bidirectional relationship fields in Obsidian frontmatter.

## Features

When you add `up: [[B]]` to note A's frontmatter, the plugin automatically adds `down: [[A]]` to note B's frontmatter.

### Supported Relations

| Source Field | Auto-Added | Relation Type |
|--------|----------|----------|
| `up` | `down` | Parent-child |
| `down` | `up` | Parent-child |
| `same` | `same` | Sibling (symmetric) |
| `next` | `prev` | Sequential |
| `prev` | `next` | Sequential |

### Automatic Behavior

- **Add relation**: Add `up: [[B]]` to A -> B automatically gets `down: [[A]]`
- **Remove relation**: Remove `up: [[B]]` from A -> B automatically loses `down: [[A]]`
- **File rename**: Automatically updates references in all linked files
- **File delete**: Automatically cleans up references in all linked files

## Usage

### Enable the plugin

1. Open Obsidian Settings -> Community plugins
2. Turn off Safe mode (if not already off)
3. Click "Browse" and search for `Bidirectional Properties`
4. Enable the plugin

### Manual full sync

Using the command palette (Cmd/Ctrl + P):
- `Sync all bidirectional properties` - scans and fixes all inconsistent relations

## Settings

| Setting | Description |
|--------|------|
| up ↔ down | Enable/disable parent-child relation sync |
| same ↔ same | Enable/disable sibling relation sync |
| next ↔ prev | Enable/disable sequential relation sync |
| Sync on startup | Automatically scan and fix when Obsidian starts |
| Show notifications | Show sync notices |
| Exclude folders | Comma-separated list of excluded folders |

## Using with Breadcrumbs

This plugin is designed for [Breadcrumbs](https://github.com/SkepticMystic/breadcrumbs) users.

Breadcrumbs provides:
- Visualization of hierarchical relationships
- Matrix and Tree views
- Navigation features

This plugin provides:
- Automatic maintenance of bidirectional relations
- Less manual sync work

## Notes

1. **Loop prevention**: The plugin automatically detects and avoids triggering infinite loops
2. **Performance**: Uses caching and debouncing, suitable for large vaults
3. **Safety**: Only modifies frontmatter, never touches note body content

## Development

```bash
# Install dependencies
npm install

# Development mode (watch for file changes)
npm run dev

# Production build
npm run build
```

## License

MIT
