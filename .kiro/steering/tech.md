---
inclusion: always
---

# Technology Stack

## Core Technologies

- **HTML5**: Semantic markup with modern features
- **CSS3**: Advanced styling with gradients, animations, flexbox/grid
- **Vanilla JavaScript**: No heavy frameworks, pure JS implementations
- **Vue.js**: Used selectively (ABC project includes vue.min.js)

## Build System

**No build system required** - This is a static web project that runs directly in browsers.

### Development Workflow
```bash
# Serve locally (any static server)
start index.html
```

### Deployment
- Direct file upload to web server
- No compilation or bundling needed
- All assets are self-contained

## Key Libraries & APIs

- **External APIs**: 
  - `https://api.jlands.cn/counter/` (Counter game backend)
  - `https://lab.magiconch.com/nbnhhsh/` (ABC abbreviation service)
- **Audio**: HTML5 Audio API for game sound effects
- **Local Storage**: Browser storage for themes and preferences

## Browser Compatibility

- **Target**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile**: Responsive design with viewport meta tags
- **Features**: ES6+ JavaScript, CSS Grid/Flexbox, HTML5 APIs

## Performance Considerations

- **Minimal Dependencies**: Prefer vanilla JS over heavy frameworks
- **Optimized Assets**: Compressed images, minified external libraries
- **Lazy Loading**: Images and resources loaded as needed
- **Caching**: Static assets with appropriate cache headers