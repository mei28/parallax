set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default: build

# Production build into dist/
build:
    pnpm run build

# Rebuild on change
watch:
    pnpm run dev

test *args:
    pnpm vitest run {{args}}

test-watch *args:
    pnpm vitest {{args}}

lint:
    pnpm run lint

fmt:
    pnpm run fmt

typecheck:
    pnpm run typecheck

# The gate before any commit. CI runs this exact recipe.
check: lint typecheck test

# Serve the fixture pages for manual verification
serve port="3000":
    python3 -m http.server {{port}} -d public/fixtures

# Same fixtures, but every response carries X-Frame-Options: DENY.
# Used to verify the FRAME_BLOCKED error surface.
serve-blocked port="3001":
    python3 public/fixtures/serve_blocked.py {{port}}

# Regenerate the extension icons from a single source definition
icons:
    python3 store-assets/build_icons.py

# Redraw the Chrome Web Store listing images and the promo tile
screenshots:
    python3 store-assets/build_screenshots.py

# Build the zip for Chrome Web Store submission
package: build
    rm -f parallax.zip
    cd dist && zip -r ../parallax.zip .

# Open Remotion Studio on the promo video (video/)
video-studio:
    cd video && pnpm exec remotion studio

# Render one composition of the promo video to video/out/<id>.mp4
video-render id:
    cd video && pnpm exec remotion render {{id}} out/{{id}}.mp4

# Render a single frame of a composition to video/out/<id>-<frame>.png
video-still id frame="0":
    cd video && pnpm exec remotion still {{id}} out/{{id}}-{{frame}}.png --frame={{frame}}

video-typecheck:
    cd video && pnpm exec tsc --noEmit
