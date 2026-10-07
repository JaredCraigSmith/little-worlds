# Little Worlds

A small, static drawing and top down adventure site for kids. Make a paper sprite sheet, take a photo, crop the grid, and wander around an island with the new character.

## Publish on GitHub Pages

This project has no build step, backend, or paid service. To publish it:

1. Create a GitHub repository and add these files to its root.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your main branch and the `/ (root)` folder, then save.
4. Open the Pages address GitHub shows after deployment.

On GitHub Free, the publishing repository needs to be public, and the published site is available on the internet. Keep private information out of the repository.

The site uses relative file paths, so it also works when GitHub Pages publishes it under a repository subpath.

## Use the drawing grid

- Choose **Print a drawing grid** and print the letter size page at 100% scale.
- Draw three rows: up, right, and down. The four boxes in each row are moments from a little walk. The game makes the left-facing row by flipping the right-facing drawings.
- Photograph the page from above in bright light. Choose the photo in **Sprite studio**, then drag the crop box to match the 4 × 3 guides to the printed lines. Leave the dark box borders and direction labels outside the crop.
- The app estimates paper color from the corners of each box. For unusual paper, use **Pick background** and click a clear patch. Connected flood fill spreads from the box edges and stops at colors that differ from the paper. Adjust tolerance for shadows or texture; lower it if light parts of the drawing disappear.
- Use **Box edge buffer** to crop inward on all four sides of every cell, trimming any printed box lines. In the review step, adjust tolerance and buffer; the preview recalculates the 12 drawings and four mirrored left-facing frames as you adjust. Click a frame to zoom in or open the eraser editor. The eraser saves per-pose touch-ups and mirrors edits between right- and left-facing poses. Use Previous/Next to compare poses.
- Return to **Play** and move with WASD, arrow keys, or the on-screen arrow pad. Entering water gives your hero a little splashy slide. Use **Summon enemies** to bring in playful critters, then press Space/Shift or tap **Dash** to bop them.

Uploaded photos and the saved character stay in the browser on that device. The cropper adjusts a rectangular frame; it does not straighten perspective, so a photo taken straight above the sheet gives the cleanest result.

## Files

- `index.html` — the app and printable sheet
- `styles.css` — responsive screen layout and print layout
- `app.js` — sprite import, local saving, and island game
- `.nojekyll` — asks GitHub Pages to serve the static files as-is
