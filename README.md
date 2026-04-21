# Moments - Digital Photo Frame

Turn any spare screen into a digital photo frame. Clean, minimal slideshow designed for always-on ambient displays.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 |
| UI | React 19.2.4, TypeScript, Tailwind CSS |
| Image Processing | Sharp (resize, transform, style filters) |
| Database | None -- file-based / transient |
| Port | Assigned by local-apps |

## Architecture

```
[Image Source]
    |
    v
[Sharp Pipeline] ---> resize / transform / apply style filters
    |
    v
[Next.js App] ---> renders slideshow on connected display
    |
    v
[iPad / Spare Monitor / Any Browser]
```

- Sharp handles all image manipulation: resize, transform, and style filters
- No database -- images are processed on the fly or served from the filesystem
- Designed for always-on displays with a clean, distraction-free UI
- Responsive layout adapts to any screen size

## Features

- Digital photo frame display for ambient screens
- Image upload and transformation API
- Style filters and transforms via Sharp
- Designed for always-on displays (iPad, spare monitor)
- Clean, minimal UI for photo slideshow
- Responsive to any screen size and orientation

## Project Structure

```
moments/
  src/
    app/             # Next.js App Router pages
    components/      # React components (slideshow, controls)
    lib/             # Sharp image processing utilities
  public/            # Static assets, sample images
  next.config.ts     # Next.js configuration
```

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Start production server |

## Environment Variables

None required. Moments is fully self-contained.

---

Built by [Bunlong Heng](https://www.bunlongheng.com) | [GitHub](https://github.com/bunlongheng/moments)
