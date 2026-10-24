# Brushwork

A mobile-friendly photo painting studio made with vanilla HTML, CSS, JavaScript, and Canvas 2D. No dependencies, build step, backend, or external requests.

Open `index.html` through this directory’s existing HTTPS address. The app loads its CSS, JavaScript, and sample image using relative paths. No installation, build, Node server, or configuration is needed.

Open or drop a photo to automatically paint it. Pick oil paint, textured oil, watercolor, impressionist, Skagen · Krøyer, or textured Skagen; adjust the brush detail and 3/5/8-second painting time; then press **Make a little art**. Compare with the original, replay, or save the finished painting as a PNG.

Textured oil keeps the original oil mode's palette and stroke planning, and adds 3–8 curved bristle bands to larger marks. Each band has its own pigment, opacity, width, and shortened ends; the offsets follow the local curve so the texture bends with the brush. Fine marks keep the simpler oil brush for detail and speed. Bristle variation has a separate random stream, allowing comparisons with the same stroke plan. This variant was inspired by the brush construction in Simon Willison’s [Quick Study](https://github.com/simonw/tools/blob/main/quick-study-painter.html); the existing oil mode remains available.

The Skagen mode is an interpretation inspired by P.S. Krøyer’s atmospheric coastal paintings. Compared with the impressionist mode, it uses restrained saturation, blue-violet shadows, warm ivory highlights, softly lifted dark tones, smoother directional brushwork, and fewer fine marks in quiet areas. Color shifts depend on brightness and are reduced for warm subjects, so the scene keeps its own colors. It suggests the light and atmosphere rather than reproducing an artist’s exact technique. Background reading: [Skagens Museum on Krøyer](https://skagensmuseum.dk/kunstnere/p-s-kroeyer/) and [Skagens Museum’s Evening Atmosphere exhibition](https://artsandculture.google.com/story/evening-atmosphere-skagens-museum/JwVxQl7YrjNPKQ?hl=en).

The renderer samples photo colors and follows a blurred image gradient field. It layers shuffled brushstrokes from broad coverage to finer edge detail, adding bristle highlights and paper grain. Painting advances in time-budgeted animation frames to keep controls responsive. Timing is a target; slower devices may take longer. Input images are scaled to a maximum of 1,200 pixels on their longest side to bound memory use. All photo processing stays on the device.

Textured Skagen preserves the Skagen palette, full stroke bodies, and fine finishing marks. Larger strokes gain 3–5 curved bristle bands with about one-third of textured oil’s pigment variation and 15–30% opacity around defined forms. Texture opacity falls to 3–6% in quiet areas to keep smooth color transitions soft. Its separate random stream preserves the original stroke plan for comparisons.

The JavaScript uses ordinary deferred scripts, with the brush renderer loaded before the application. There are no module imports or runtime dependencies.

The bundled [sample photo](assets/alpine-afternoon.png) was created with the built-in imagegen tool. Prompt: “A natural landscape photograph of a quiet Italian alpine lake with turquoise water, a cream villa with a terracotta roof, cypress trees, layered mountains, and pale pink flowers in the foreground; soft summer afternoon light; landscape 4:3; no text, watermark, or painting effect.”
