---
inclusion: always
---

# Project Structure

## Root Level Organization

```
/
├── index.html              # Main portfolio hub page
├── canvas.html            # Canvas-related functionality
├── [project-name]/        # Individual project folders
│   ├── index.html         # Project entry point
│   ├── js/               # JavaScript files
│   ├── css/              # Stylesheets (if separate)
│   └── audio/            # Audio assets (games)
└── .kiro/                # Kiro configuration
```

## Project Folder Conventions

Each project follows a consistent structure:

- **`index.html`**: Main entry point with embedded CSS/JS or external references
- **`js/`**: JavaScript files (script.js, external libraries)
- **`css/`**: Separate stylesheets when CSS is extensive
- **`audio/`**: Sound effects for interactive projects (.ogg format preferred)

## File Naming Patterns

- **HTML**: `index.html` for main pages, descriptive names for others
- **JavaScript**: `script.js` for main logic, `[library].min.js` for external libs
- **CSS**: `[project-name]-style.css` or embedded in HTML
- **Assets**: Descriptive names (`bow.ogg`, `successful_hit.ogg`)

## Code Organization

### HTML Structure
- DOCTYPE HTML5
- Responsive viewport meta tag
- Chinese language support (`lang="zh-CN"`)
- Embedded styles in `<style>` tags (common pattern)
- Scripts at bottom of body

### CSS Patterns
- CSS custom properties for theming
- Flexbox/Grid for layouts
- Smooth transitions (0.3s ease)
- Responsive breakpoints (@media queries)
- Theme classes (`.pink-theme`, `.dark-theme`)

### JavaScript Architecture
- Event-driven programming
- DOM manipulation with vanilla JS
- Local storage for persistence
- Modular functions with clear naming
- Error handling for external APIs

## Asset Management

- **Images**: Inline SVG or optimized formats
- **Audio**: .ogg format for web compatibility
- **Fonts**: System fonts preferred (`'Microsoft YaHei'`, fallbacks)
- **Icons**: Unicode emojis or simple CSS shapes

## Development Guidelines

- **Self-contained**: Each project should work independently
- **Mobile-first**: Responsive design from the start
- **Progressive Enhancement**: Core functionality without JS
- **Accessibility**: Semantic HTML, keyboard navigation
- **Performance**: Minimal external dependencies