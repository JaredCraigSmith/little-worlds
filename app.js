(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = 'littleworlds-save-v1';
  const DRAW_ROWS = ['up', 'right', 'down'];
  const ARROWS = ['↑', '→', '↓', '←'];
  const LABELS = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
  const directions = { up: 0, right: 1, down: 2, left: 3 };
  const biomeData = {
    meadow: { title: 'Sunny Meadow', emoji: '🌿', message: 'A sunny meadow! You made it.' },
    forest: { title: 'Pinecone Forest', emoji: '🌲', message: 'A forest! Can you spot a pinecone?' },
    snow: { title: 'Snowy Nook', emoji: '❄️', message: 'A snowy place! Brrr, but cozy.' },
    desert: { title: 'Sunbeam Desert', emoji: '☀️', message: 'A sandy desert! Look for a cactus.' },
    beach: { title: 'Sandy Shore', emoji: '🏖️', message: 'A beach! The water is just ahead.' },
    water: { title: 'Splashy Blue', emoji: '💧', message: 'You can swim! The water feels lovely.' }
  };
  const idolData = [
    { biome: 'meadow', tx: 59, ty: 39, glyph: '🌼', title: 'Sunbloom Idol', boss: 'Petalcoil', bossTitle: 'giant flower snake', bossType: 'flower-snake', minions: 'bloom sprites', minionCount: 3, palette: ['#d98291', '#f1bd58', '#68945e'] },
    { biome: 'forest', tx: 34, ty: 42, glyph: '🌱', title: 'Mossheart Idol', boss: 'Bramblewing', bossTitle: 'leafy dragon', bossType: 'leaf-dragon', minions: 'acorn bugs', minionCount: 3, palette: ['#558a63', '#b2c878', '#805c43'] },
    { biome: 'snow', tx: 35, ty: 18, glyph: '❄️', title: 'Frostbell Idol', boss: 'Frostwing', bossTitle: 'gentle glacier dragon', bossType: 'ice-dragon', minions: 'snow sprites', minionCount: 4, palette: ['#8fc5d4', '#eff8f1', '#8eabc6'] },
    { biome: 'desert', tx: 76, ty: 34, glyph: '☀️', title: 'Sunstone Idol', boss: 'Suncurl', bossTitle: 'giant sand serpent', bossType: 'sand-serpent', minions: 'sand skitters', minionCount: 3, palette: ['#d58e4f', '#f1cf73', '#9b704b'] },
    { biome: 'water', tx: 50, ty: 45, glyph: '💎', title: 'Tideglass Idol', boss: 'Coralback', bossTitle: 'tidepool kraken', bossType: 'tide-kraken', minions: 'bubble sprites', minionCount: 4, palette: ['#648fbc', '#f3a7a0', '#90d3c8'] }
  ];

  const gameCanvas = $('#gameCanvas');
  const gameCtx = gameCanvas.getContext('2d');
  const portraitCanvas = $('#portraitCanvas');
  const portraitCtx = portraitCanvas.getContext('2d');
  const cropCanvas = $('#cropCanvas');
  const cropCtx = cropCanvas.getContext('2d');
  const cropStage = $('#cropStage');
  const cropOverlay = $('#cropOverlay');
  const gameViewport = $('#gameViewport');
  const player = { x: 56 * 32, y: 40 * 32, face: 'down', walkTime: 0, moving: false, inWater: false, slideTimer: 0, slideDX: 0, slideDY: 1, dashTimer: 0, dashCooldown: 0, dashDX: 0, dashDY: 1, dashHitBoss: false };
  const pressed = new Set();
  const enemies = [];
  const found = new Set(['meadow']);
  const defeatedBosses = new Set();
  const awakenedIdols = new Set();
  let activeBossId = null;
  let nearbyIdolId = '';
  let spriteFrames = null;
  let baseFrames = null;
  let manualEraseMasks = Array.from({ length: 12 }, () => new Set());
  let photoImage = null;
  let crop = null;
  let cropDrag = null;
  let sampledBackground = null;
  let backgroundTolerance = 36;
  let edgeBuffer = 7;
  let pickingBackground = false;
  let recalculateTimer = 0;
  let processingVersion = 0;
  let currentDetailFrame = -1;
  let frameEditorOpen = false;
  let editorImageData = null;
  let erasePointerDown = false;
  let eraseStroke = [];
  let eraseHistory = [];
  let gameWidth = 0;
  let gameHeight = 0;
  let frameTime = 0;
  let lastTick = performance.now();
  let lastBiome = '';
  let toastTimer = 0;
  let played = false;
  let soundOn = false;
  let audioContext = null;
  let waveTimer = 0;
  let randomSoundTimer = 0;

  function safeLoad() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function safeSave(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    catch { /* A large camera image may exceed storage; the current session still works. */ }
  }
  function emptyEraseMasks() { return Array.from({ length: 12 }, () => new Set()); }
  function restoreEraseMasks(saved) {
    return Array.from({ length: 12 }, (_, frame) => new Set(
      Array.isArray(saved?.[frame]) ? saved[frame].filter(pixel => Number.isInteger(pixel) && pixel >= 0 && pixel < 4096) : []
    ));
  }
  function eraseSourceForFrame(frame) {
    return frame >= 12 ? { frame: 4 + frame - 12, flipped: true } : { frame, flipped: false };
  }
  function saveSettings() {
    const existing = safeLoad();
    safeSave({ ...existing, name: $('#heroName').value.trim().slice(0, 18) || 'Pip' });
  }

  function makeDefaultSprite(dir, pose) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const px = (color, xx, yy, w, h) => { x.fillStyle = color; x.fillRect(xx, yy, w, h); };
    const bob = pose === 1 ? -1 : pose === 3 ? 1 : 0;
    const leg = pose === 1 ? 1 : pose === 3 ? -1 : 0;
    // Tiny backpack and feet keep their color when the hero turns around.
    if (dir === 'up') px('#75946a', 9, 11 + bob, 14, 12);
    else px('#78996e', dir === 'left' ? 5 : 20, 12 + bob, 7, 11);
    px('#4d5942', 10 + leg, 25, 5, 4);
    px('#4d5942', 18 - leg, 25, 5, 4);
    px('#f3c896', 9, 6 + bob, 14, 13);
    px('#755b48', 8, 5 + bob, 16, 4);
    if (dir === 'up') {
      px('#755b48', 8, 8 + bob, 4, 6); px('#755b48', 20, 8 + bob, 4, 6);
      px('#d9a879', 12, 12 + bob, 8, 6);
    } else {
      if (dir === 'left') {
        px('#53685a', 8, 12 + bob, 2, 2); px('#fff5dc', 8, 12 + bob, 1, 1);
        px('#ad725a', 7, 16 + bob, 2, 1); px('#edb981', 9, 18 + bob, 14, 2);
      } else if (dir === 'right') {
        px('#53685a', 22, 12 + bob, 2, 2); px('#fff5dc', 23, 12 + bob, 1, 1);
        px('#ad725a', 23, 16 + bob, 2, 1); px('#edb981', 9, 18 + bob, 14, 2);
      } else {
        px('#53685a', 12, 12 + bob, 2, 2); px('#53685a', 19, 12 + bob, 2, 2);
        px('#fff5dc', 12, 12 + bob, 1, 1); px('#fff5dc', 19, 12 + bob, 1, 1);
        px('#ae745b', 15, 16 + bob, 3, 1); px('#edb981', 11, 18 + bob, 10, 2);
      }
    }
    px('#f3c896', 7, 17 + bob, 3, 4); px('#f3c896', 22, 17 + bob, 3, 4);
    px('#729568', 11, 20 + bob, 10, 6);
    px('#f1d58b', 14, 21 + bob, 4, 3);
    if (pose === 1 || pose === 3) {
      px('#75946a', 8, 24, 5, 3); px('#75946a', 19, 24, 5, 3);
    }
    return c;
  }

  function installSampleSprite() {
    manualEraseMasks = emptyEraseMasks();
    baseFrames = [];
    for (const dir of DRAW_ROWS) for (let pose = 0; pose < 4; pose++) baseFrames.push(makeDefaultSprite(dir, pose).toDataURL());
    buildProcessedFrames();
  }

  function saveSprite() {
    if (!baseFrames?.length) return;
    const existing = safeLoad();
    safeSave({ ...existing, name: $('#heroName').value.trim().slice(0, 18) || 'Pip', baseFrames, manualEraseMasks: manualEraseMasks.map(mask => [...mask]), paperRemoval: $('#paperRemoval').checked, backgroundColor: sampledBackground, backgroundTolerance, edgeBuffer });
  }

  function restoreSprite() {
    const data = safeLoad();
    defeatedBosses.clear();
    if (Array.isArray(data.defeatedBosses)) data.defeatedBosses.filter(id => idolData.some(idol => idol.biome === id)).forEach(id => defeatedBosses.add(id));
    if (data.name) $('#heroName').value = data.name;
    if (Array.isArray(data.baseFrames) && [12, 16].includes(data.baseFrames.length)) {
      // Older saves include a hand-drawn left row; the right row now supplies it by mirroring.
      baseFrames = data.baseFrames.slice(0, 12);
      manualEraseMasks = restoreEraseMasks(data.manualEraseMasks);
      $('#paperRemoval').checked = data.paperRemoval !== false;
      sampledBackground = data.backgroundColor && ['r', 'g', 'b'].every(key => Number.isFinite(data.backgroundColor[key])) ? data.backgroundColor : null;
      backgroundTolerance = clamp(Number(data.backgroundTolerance ?? 36), 0, 120);
      edgeBuffer = clamp(Number(data.edgeBuffer ?? 7), 0, 18);
      buildProcessedFrames();
    } else installSampleSprite();
    updateBackgroundControls();
    updatePortrait();
    updateIdolProgress();
  }

  function updatePortrait() {
    if (!portraitCtx || !spriteFrames?.length) return;
    portraitCtx.clearRect(0, 0, 96, 96);
    const frame = spriteFrames[8]; // Down-facing first pose.
    if (frame?.complete) {
      portraitCtx.imageSmoothingEnabled = false;
      portraitCtx.drawImage(frame, 13, 11, 70, 76);
    }
  }

  function createGrid() {
    const build = (root, printable) => {
      root.replaceChildren();
      DRAW_ROWS.forEach((dir, row) => {
        const label = document.createElement('div');
        label.className = printable ? 'print-row-label' : 'paper-row-label';
        label.innerHTML = `${ARROWS[row]} <small>${LABELS[row]}</small>`;
        root.append(label);
        for (let col = 0; col < 4; col++) {
          const cell = document.createElement('div');
          cell.className = printable ? 'print-cell' : 'paper-cell';
          root.append(cell);
        }
      });
    };
    build($('#paperGrid'), false);
    build($('#printGrid'), true);
  }

  function openPrint() {
    window.print();
  }
  $('#printButton').addEventListener('click', openPrint);
  $('#smallPrintButton').addEventListener('click', openPrint);
  $('#studioPrintButton').addEventListener('click', () => { openPrint(); showStepTwo(); });

  function showView(view) {
    for (const name of ['home', 'play', 'studio']) {
      const section = $(`#${name}View`);
      const active = name === view;
      section.classList.toggle('active', active);
      section.hidden = !active;
    }
    $$('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    pressed.clear();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'play') {
      resizeGame();
      window.setTimeout(resizeGame, 40);
    }
  }
  $$('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('.brand').addEventListener('click', event => { event.preventDefault(); showView('home'); });

  function showStepTwo() {
    $('#stepOne').classList.remove('current');
    $('#stepTwo').classList.add('current');
    $('#drawStep').hidden = true;
    $('#bringStep').hidden = false;
    $('#bringStep').classList.add('step-active');
    $('#bringStep').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function resetStudio() {
    window.clearTimeout(recalculateTimer); processingVersion++;
    photoImage = null; crop = null; cropDrag = null;
    pickingBackground = false; cropStage.classList.remove('sampling');
    $('#pickBackgroundButton').classList.remove('active');
    $('#pickBackgroundButton').querySelector('span').textContent = 'Pick background';
    $('#sheetInput').value = '';
    $('#paperPreview').hidden = false;
    $('#scanWorkspace').hidden = true;
    $('#importedWorkspace').hidden = true;
    $('#clearPhotoButton').hidden = true;
    $('#clearPhotoButton').textContent = 'Clear photo';
    $('#paperBadge').innerHTML = '<i></i> PRINTABLE SHEET';
    $('#workspaceTitle').textContent = 'Your drawing grid';
    $('#workspaceSubtitle').textContent = 'A little practice sheet for your hero';
    $('#workspaceNote').innerHTML = '<span>✦</span> Print at 100% size for the clearest boxes. Plain paper works great.';
    $('#stepOne').classList.add('current'); $('#stepTwo').classList.remove('current');
    $('#drawStep').hidden = false;
    $('#bringStep').hidden = true;
    $('#bringStep').classList.remove('step-active');
  }
  $('#clearPhotoButton').addEventListener('click', resetStudio);
  $('#adjustPhotoButton').addEventListener('click', () => {
    $('#scanWorkspace').hidden = false; $('#importedWorkspace').hidden = true;
    $('#workspaceTitle').textContent = 'Adjust your drawing'; $('#workspaceSubtitle').textContent = 'Fit the crop to the boxes and choose the paper color';
    drawCropPhoto();
  });

  const fileInput = $('#sheetInput');
  fileInput.addEventListener('change', () => { const file = fileInput.files?.[0]; if (file) loadPhoto(file); });
  const uploadDrop = $('#uploadDrop');
  uploadDrop.addEventListener('dragover', event => { event.preventDefault(); uploadDrop.classList.add('dragover'); });
  uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('dragover'));
  uploadDrop.addEventListener('drop', event => {
    event.preventDefault(); uploadDrop.classList.remove('dragover');
    const file = event.dataTransfer.files?.[0]; if (file?.type.startsWith('image/')) loadPhoto(file);
  });

  function loadPhoto(file) {
    window.clearTimeout(recalculateTimer); processingVersion++;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        photoImage = image;
        sampledBackground = null;
        pickingBackground = false;
        cropStage.classList.remove('sampling');
        $('#pickBackgroundButton').classList.remove('active');
        $('#pickBackgroundButton').querySelector('span').textContent = 'Pick background';
        updateBackgroundControls();
        $('#paperPreview').hidden = true;
        $('#scanWorkspace').hidden = false;
        $('#importedWorkspace').hidden = true;
        $('#clearPhotoButton').hidden = false;
        $('#paperBadge').innerHTML = '<i></i> PHOTO CROP';
        $('#workspaceTitle').textContent = 'Adjust your drawing';
        $('#workspaceSubtitle').textContent = 'Fit the crop to the boxes and choose the paper color';
        $('#workspaceNote').innerHTML = '<span>✦</span> Drag any corner freely. Match the guide lines to the box edges; leave the printed borders and labels outside.';
        initCrop(); showStepTwo(); drawCropPhoto();
      };
      image.onerror = () => window.alert('That picture could not be opened. Try a JPG or PNG image.');
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function initCrop() {
    const w = photoImage.naturalWidth, h = photoImage.naturalHeight;
    // Four columns and three rows make a 4:3 grid. Start with a centered crop
    // that fits the photo, leaving room for page edges and camera tilt.
    const width = Math.min(w * .95, h * (4 / 3) * .95);
    const height = width * (3 / 4);
    crop = { x: (w - width) / 2, y: (h - height) / 2, w: width, h: height };
  }
  $('#resetCropButton').addEventListener('click', () => { if (photoImage) { initCrop(); positionCropOverlay(); } });

  function drawCropPhoto() {
    if (!photoImage || $('#scanWorkspace').hidden) return;
    const availableW = Math.max(240, cropStage.clientWidth || 620);
    const availableH = Math.max(200, Math.min(440, window.innerHeight * .53));
    const scale = Math.min(availableW / photoImage.naturalWidth, availableH / photoImage.naturalHeight, 1);
    const w = Math.max(1, Math.round(photoImage.naturalWidth * scale));
    const h = Math.max(1, Math.round(photoImage.naturalHeight * scale));
    cropCanvas.width = w; cropCanvas.height = h;
    cropCanvas.style.width = `${w}px`; cropCanvas.style.height = `${h}px`;
    cropCtx.clearRect(0, 0, w, h); cropCtx.drawImage(photoImage, 0, 0, w, h);
    positionCropOverlay();
  }

  function positionCropOverlay() {
    if (!crop || !photoImage) return;
    const bounds = cropCanvas.getBoundingClientRect();
    const stage = cropStage.getBoundingClientRect();
    const sx = bounds.width / photoImage.naturalWidth;
    const sy = bounds.height / photoImage.naturalHeight;
    cropOverlay.style.left = `${bounds.left - stage.left + crop.x * sx}px`;
    cropOverlay.style.top = `${bounds.top - stage.top + crop.y * sy}px`;
    cropOverlay.style.width = `${crop.w * sx}px`;
    cropOverlay.style.height = `${crop.h * sy}px`;
  }
  window.addEventListener('resize', () => { if (photoImage && !$('#scanWorkspace').hidden) drawCropPhoto(); });

  function pointInImage(event) {
    const bounds = cropCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * photoImage.naturalWidth / bounds.width,
      y: (event.clientY - bounds.top) * photoImage.naturalHeight / bounds.height
    };
  }
  cropOverlay.addEventListener('pointerdown', event => {
    if (!crop) return;
    const point = pointInImage(event);
    const cornerEl = event.target.closest('.crop-corner');
    const corner = cornerEl ? [...cornerEl.classList].find(name => ['tl', 'tr', 'bl', 'br'].includes(name)) : null;
    let anchor = null;
    if (corner) anchor = { x: corner.includes('l') ? crop.x + crop.w : crop.x, y: corner.includes('t') ? crop.y + crop.h : crop.y };
    cropDrag = { mode: corner ? 'resize' : 'move', corner, anchor, point, original: { ...crop } };
    cropOverlay.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  cropOverlay.addEventListener('pointermove', event => {
    if (!cropDrag || !photoImage) return;
    const point = pointInImage(event);
    if (cropDrag.mode === 'move') {
      const dx = point.x - cropDrag.point.x, dy = point.y - cropDrag.point.y;
      crop.x = clamp(cropDrag.original.x + dx, 0, photoImage.naturalWidth - crop.w);
      crop.y = clamp(cropDrag.original.y + dy, 0, photoImage.naturalHeight - crop.h);
    } else {
      const a = cropDrag.anchor;
      const px = clamp(point.x, 0, photoImage.naturalWidth), py = clamp(point.y, 0, photoImage.naturalHeight);
      const minW = Math.min(20, a.x, photoImage.naturalWidth - a.x);
      const minH = Math.min(20, a.y, photoImage.naturalHeight - a.y);
      const minX = cropDrag.corner.includes('l') ? clamp(px, 0, a.x - minW) : a.x;
      const maxX = cropDrag.corner.includes('l') ? a.x : clamp(px, a.x + minW, photoImage.naturalWidth);
      const minY = cropDrag.corner.includes('t') ? clamp(py, 0, a.y - minH) : a.y;
      const maxY = cropDrag.corner.includes('t') ? a.y : clamp(py, a.y + minH, photoImage.naturalHeight);
      crop = {
        x: minX, y: minY, w: maxX - minX, h: maxY - minY
      };
    }
    positionCropOverlay();
  });
  const stopCropDrag = () => { cropDrag = null; };
  cropOverlay.addEventListener('pointerup', stopCropDrag);
  cropOverlay.addEventListener('pointercancel', stopCropDrag);

  function updateBackgroundControls() {
    const swatch = $('#paperSwatch');
    if (!swatch) return;
    const color = sampledBackground;
    swatch.style.backgroundColor = color ? `rgb(${color.r}, ${color.g}, ${color.b})` : '#fff';
    swatch.classList.toggle('sampled', !!color);
    $('#paperColorStatus').textContent = color
      ? `Sampled ${toHex(color)} · flood fill starts with this color`
      : 'Automatic · we’ll read each box edge';
    $('#backgroundTolerance').value = String(backgroundTolerance);
    $('#toleranceValue').value = String(backgroundTolerance);
    $('#toleranceValue').textContent = String(backgroundTolerance);
    $('#edgeBuffer').value = String(edgeBuffer);
    $('#edgeBufferValue').value = `${edgeBuffer}%`;
    $('#edgeBufferValue').textContent = `${edgeBuffer}%`;
    $('#previewTolerance').value = String(backgroundTolerance);
    $('#previewToleranceValue').value = String(backgroundTolerance);
    $('#previewToleranceValue').textContent = String(backgroundTolerance);
    $('#previewBuffer').value = String(edgeBuffer);
    $('#previewBufferValue').value = `${edgeBuffer}%`;
    $('#previewBufferValue').textContent = `${edgeBuffer}%`;
  }
  function toHex(color) {
    return `#${[color.r, color.g, color.b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }
  $('#pickBackgroundButton').addEventListener('click', () => {
    if (!photoImage) return;
    pickingBackground = true;
    cropStage.classList.add('sampling');
    $('#pickBackgroundButton').classList.add('active');
    $('#pickBackgroundButton').querySelector('span').textContent = 'Click the paper color…';
    $('#paperColorStatus').textContent = 'Click a clear patch of paper in the photo';
  });
  cropStage.addEventListener('click', event => {
    if (!pickingBackground || event.target !== cropCanvas || !photoImage) return;
    const point = pointInImage(event);
    if (point.x < 0 || point.y < 0 || point.x >= photoImage.naturalWidth || point.y >= photoImage.naturalHeight) return;
    const sample = document.createElement('canvas'); sample.width = sample.height = 1;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(photoImage, Math.floor(point.x), Math.floor(point.y), 1, 1, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    sampledBackground = { r: data[0], g: data[1], b: data[2] };
    pickingBackground = false;
    cropStage.classList.remove('sampling');
    $('#pickBackgroundButton').classList.remove('active');
    $('#pickBackgroundButton').querySelector('span').textContent = 'Pick background';
    updateBackgroundControls();
  });
  $('#backgroundTolerance').addEventListener('input', event => {
    backgroundTolerance = Number(event.target.value);
    updateBackgroundControls();
    markPreviewDirty();
  });
  $('#previewTolerance').addEventListener('input', event => {
    backgroundTolerance = Number(event.target.value);
    updateBackgroundControls();
    markPreviewDirty();
  });
  $('#edgeBuffer').addEventListener('input', event => {
    edgeBuffer = Number(event.target.value);
    updateBackgroundControls();
    markPreviewDirty();
  });
  $('#previewBuffer').addEventListener('input', event => {
    edgeBuffer = Number(event.target.value);
    updateBackgroundControls();
    markPreviewDirty();
  });
  $('#recalculatePreviewButton').addEventListener('click', recalculatePreview);
  $('#paperRemoval').addEventListener('change', markPreviewDirty);

  $('#useSheetButton').addEventListener('click', () => {
    if (!photoImage || !crop) return;
    const cellW = crop.w / 4, cellH = crop.h / DRAW_ROWS.length;
    baseFrames = [];
    manualEraseMasks = emptyEraseMasks();
    for (let row = 0; row < DRAW_ROWS.length; row++) for (let col = 0; col < 4; col++) {
      const frame = document.createElement('canvas');
      frame.width = frame.height = 64;
      const fctx = frame.getContext('2d', { willReadFrequently: true });
      fctx.imageSmoothingEnabled = true;
      fctx.drawImage(photoImage, crop.x + col * cellW, crop.y + row * cellH, cellW, cellH, 0, 0, 64, 64);
      baseFrames.push(frame.toDataURL('image/png'));
    }
    $('#previewStatus').textContent = 'Building 12 drawn frames and mirroring left…';
    $('#recalculatePreviewButton').disabled = true;
    buildProcessedFrames();
    $('#scanWorkspace').hidden = true; $('#importedWorkspace').hidden = false;
    $('#workspaceTitle').textContent = 'Your hero, in 16 little moments'; $('#workspaceSubtitle').textContent = 'Left-facing poses are mirrored from the right';
    $('#workspaceNote').innerHTML = '<span>✦</span> Your drawing is saved on this device. Head back to the island and start exploring!';
  });

  function markPreviewDirty() {
    if ($('#importedWorkspace').hidden || !baseFrames) return;
    $('#previewStatus').textContent = 'Settings changed · updating preview…';
    $('#recalculatePreviewButton').disabled = false;
    window.clearTimeout(recalculateTimer);
    recalculateTimer = window.setTimeout(recalculatePreview, 280);
  }
  function recalculatePreview() {
    window.clearTimeout(recalculateTimer);
    if (!baseFrames?.length) return;
    $('#previewStatus').textContent = 'Recalculating 12 drawings and mirrored poses…';
    $('#recalculatePreviewButton').disabled = true;
    buildProcessedFrames();
  }

  function buildProcessedFrames() {
    const version = ++processingVersion;
    const remove = $('#paperRemoval').checked;
    const paperSample = sampledBackground;
    const tolerance = backgroundTolerance;
    const insetRatio = edgeBuffer / 100;
    const nextFrames = new Array(12);
    let pending = baseFrames.length;
    const finish = frames => {
      if (version !== processingVersion) return;
      spriteFrames = frames;
      renderSpritePreview(); saveSprite(); updatePortrait();
      if ($('#frameDialog').open) showFrameDetails(currentDetailFrame);
      if (!$('#importedWorkspace').hidden) {
        $('#previewStatus').textContent = 'Preview is up to date';
        $('#recalculatePreviewButton').disabled = true;
      }
    };
    const ready = (index, image) => {
      if (version !== processingVersion) return;
      nextFrames[index] = image;
      pending--;
      if (pending) return;
      // Keep four poses per direction at runtime, deriving left from right.
      const mirrored = new Array(4);
      let mirrorsPending = 4;
      for (let pose = 0; pose < 4; pose++) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.translate(64, 0); ctx.scale(-1, 1); ctx.drawImage(nextFrames[4 + pose], 0, 0, 64, 64);
        const image = new Image();
        image.onload = () => {
          if (version !== processingVersion) return;
          mirrored[pose] = image;
          if (--mirrorsPending === 0) finish([...nextFrames, ...mirrored]);
        };
        image.src = canvas.toDataURL('image/png');
      }
    };
    baseFrames.forEach((src, index) => {
      const source = new Image();
      const processed = new Image();
      processed.onload = () => ready(index, processed);
      source.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        const insetX = source.naturalWidth * insetRatio, insetY = source.naturalHeight * insetRatio;
        ctx.drawImage(source, insetX, insetY, source.naturalWidth - insetX * 2, source.naturalHeight - insetY * 2, 0, 0, 64, 64);
        if (remove) floodRemovePaper(ctx, paperSample || estimateEdgePaper(ctx), tolerance);
        applyManualErasures(ctx, index);
        processed.src = c.toDataURL('image/png');
      };
      source.src = src;
    });
  }

  function applyManualErasures(ctx, index) {
    const mask = manualEraseMasks[index];
    if (!mask?.size) return;
    const image = ctx.getImageData(0, 0, 64, 64);
    for (const pixel of mask) image.data[pixel * 4 + 3] = 0;
    ctx.putImageData(image, 0, 0);
  }

  function floodRemovePaper(ctx, paper, tolerance) {
    const width = 64, height = 64;
    const image = ctx.getImageData(0, 0, width, height);
    const pixels = image.data;
    const visited = new Uint8Array(width * height);
    const queue = new Uint16Array(width * height);
    let head = 0, tail = 0;
    const matchesPaper = pixel => {
      const offset = pixel * 4;
      return Math.abs(pixels[offset] - paper.r) <= tolerance &&
        Math.abs(pixels[offset + 1] - paper.g) <= tolerance &&
        Math.abs(pixels[offset + 2] - paper.b) <= tolerance;
    };
    const add = pixel => {
      if (visited[pixel] || !matchesPaper(pixel)) return;
      visited[pixel] = 1;
      pixels[pixel * 4 + 3] = 0;
      queue[tail++] = pixel;
    };
    for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { add(y * width); add(y * width + width - 1); }
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
      if (x > 0) add(pixel - 1);
      if (x < width - 1) add(pixel + 1);
      if (y > 0) add(pixel - width);
      if (y < height - 1) add(pixel + width);
    }
    ctx.putImageData(image, 0, 0);
  }

  function estimateEdgePaper(ctx) {
    const image = ctx.getImageData(0, 0, 64, 64).data;
    const channels = [[], [], []];
    const add = (x, y) => {
      const i = (y * 64 + x) * 4;
      for (let channel = 0; channel < 3; channel++) channels[channel].push(image[i + channel]);
    };
    for (let y = 3; y < 10; y++) for (let x = 3; x < 10; x++) add(x, y);
    for (let y = 3; y < 10; y++) for (let x = 54; x < 61; x++) add(x, y);
    for (let y = 54; y < 61; y++) for (let x = 3; x < 10; x++) add(x, y);
    for (let y = 54; y < 61; y++) for (let x = 54; x < 61; x++) add(x, y);
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return { r: median(channels[0]), g: median(channels[1]), b: median(channels[2]) };
  }

  function renderSpritePreview() {
    const grid = $('#spriteResultGrid'); grid.replaceChildren();
    spriteFrames?.forEach((frame, index) => {
      const row = Math.floor(index / 4), pose = index % 4 + 1;
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'sprite-frame';
      cell.setAttribute('aria-label', `Zoom in on ${LABELS[row].toLowerCase()} pose ${pose}`);
      const img = document.createElement('img'); img.alt = ''; img.src = frame.src;
      const label = document.createElement('span'); label.className = 'frame-label'; label.textContent = `${ARROWS[row]} ${LABELS[row]} · ${pose}`;
      cell.append(img, label); cell.addEventListener('click', () => showFrameDetails(index)); grid.append(cell);
    });
  }
  function showFrameDetails(index) {
    if (!spriteFrames?.[index]) return;
    if (currentDetailFrame !== index) eraseHistory = [];
    currentDetailFrame = index;
    const frame = spriteFrames[index], row = Math.floor(index / 4), pose = index % 4 + 1;
    $('#frameDetailImage').src = frame.src;
    $('#frameDialogTitle').textContent = `${ARROWS[row]} ${LABELS[row][0]}${LABELS[row].slice(1).toLowerCase()} · pose ${pose} of 4`;
    $('#frameDetailImage').hidden = frameEditorOpen;
    $('#frameEditorCanvas').hidden = !frameEditorOpen;
    $('#frameEditorPanel').hidden = !frameEditorOpen;
    $('#editFrameButton').hidden = frameEditorOpen;
    $('.frame-detail-caption span').textContent = frameEditorOpen
      ? (row === 1 || row === 3 ? 'Edits are mirrored between right and left' : 'Erase background around this pose')
      : 'Sprite frame';
    drawFrameEditor(frame);
    updateUndoButton();
    if (!$('#frameDialog').open) $('#frameDialog').showModal();
  }
  function drawFrameEditor(frame) {
    const canvas = $('#frameEditorCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 64, 64); ctx.imageSmoothingEnabled = false;
    if (frame?.complete && frame.naturalWidth) ctx.drawImage(frame, 0, 0, 64, 64);
    editorImageData = ctx.getImageData(0, 0, 64, 64);
  }
  function updateUndoButton() { $('#undoEraseButton').disabled = !eraseHistory.length; }

  $('#editFrameButton').addEventListener('click', () => {
    frameEditorOpen = true; eraseHistory = [];
    showFrameDetails(currentDetailFrame);
  });
  $('#doneFrameEditingButton').addEventListener('click', () => {
    frameEditorOpen = false;
    showFrameDetails(currentDetailFrame);
  });
  $('#eraserSize').addEventListener('input', event => {
    $('#eraserSizeValue').textContent = `${event.target.value} px`;
  });
  $('#frameEditorCanvas').addEventListener('pointerdown', event => {
    if (!frameEditorOpen) return;
    erasePointerDown = true; eraseStroke = [];
    event.currentTarget.setPointerCapture(event.pointerId);
    eraseOnCanvas(event); event.preventDefault();
  });
  $('#frameEditorCanvas').addEventListener('pointermove', event => {
    if (erasePointerDown) eraseOnCanvas(event);
  });
  function finishEraseStroke() {
    if (!erasePointerDown) return;
    erasePointerDown = false;
    if (!eraseStroke.length) return;
    eraseHistory.push(eraseStroke); eraseStroke = [];
    updateUndoButton(); saveSprite(); recalculatePreview();
  }
  $('#frameEditorCanvas').addEventListener('pointerup', finishEraseStroke);
  $('#frameEditorCanvas').addEventListener('pointercancel', finishEraseStroke);
  function eraseOnCanvas(event) {
    const canvas = $('#frameEditorCanvas'), bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !editorImageData) return;
    const x = clamp(Math.floor((event.clientX - bounds.left) * 64 / bounds.width), 0, 63);
    const y = clamp(Math.floor((event.clientY - bounds.top) * 64 / bounds.height), 0, 63);
    const radius = Number($('#eraserSize').value) / 2;
    const extent = Math.ceil(radius);
    const source = eraseSourceForFrame(currentDetailFrame);
    const mask = manualEraseMasks[source.frame];
    let changed = false;
    for (let dy = -extent; dy <= extent; dy++) for (let dx = -extent; dx <= extent; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = x + dx, py = y + dy;
      if (px < 0 || px >= 64 || py < 0 || py >= 64) continue;
      const sourceX = source.flipped ? 63 - px : px;
      const pixel = py * 64 + sourceX;
      if (!mask.has(pixel)) {
        mask.add(pixel); eraseStroke.push([source.frame, pixel]); changed = true;
      }
      editorImageData.data[(py * 64 + px) * 4 + 3] = 0;
    }
    if (changed) $('#frameEditorCanvas').getContext('2d').putImageData(editorImageData, 0, 0);
  }
  $('#undoEraseButton').addEventListener('click', () => {
    const stroke = eraseHistory.pop();
    if (!stroke) return;
    for (const [frame, pixel] of stroke) manualEraseMasks[frame].delete(pixel);
    updateUndoButton(); saveSprite(); recalculatePreview();
  });
  $('#clearFrameEraseButton').addEventListener('click', () => {
    const source = eraseSourceForFrame(currentDetailFrame);
    if (!manualEraseMasks[source.frame].size) return;
    manualEraseMasks[source.frame].clear(); eraseHistory = [];
    updateUndoButton(); saveSprite(); recalculatePreview();
  });
  $('#closeFrameDialog').addEventListener('click', () => $('#frameDialog').close());
  $('#frameDialog').addEventListener('close', () => { frameEditorOpen = false; erasePointerDown = false; eraseStroke = []; eraseHistory = []; });
  $('#previousFrame').addEventListener('click', () => showFrameDetails((currentDetailFrame + 15) % 16));
  $('#nextFrame').addEventListener('click', () => showFrameDetails((currentDetailFrame + 1) % 16));
  $('#frameDialog').addEventListener('click', event => { if (event.target === $('#frameDialog')) $('#frameDialog').close(); });
  $('#sampleButton').addEventListener('click', () => {
    sampledBackground = null;
    manualEraseMasks = emptyEraseMasks();
    baseFrames = [];
    for (const dir of DRAW_ROWS) for (let pose = 0; pose < 4; pose++) baseFrames.push(makeDefaultSprite(dir, pose).toDataURL());
    $('#paperRemoval').checked = true;
    $('#paperPreview').hidden = true; $('#scanWorkspace').hidden = true; $('#importedWorkspace').hidden = false;
    $('#clearPhotoButton').hidden = false; $('#clearPhotoButton').textContent = 'Start over'; $('#paperBadge').innerHTML = '<i></i> YOUR HERO';
    $('#workspaceTitle').textContent = 'A sample hero, ready to go'; $('#workspaceSubtitle').textContent = 'You can swap in your own drawing whenever you like';
    $('#workspaceNote').innerHTML = '<span>✦</span> This sample lives on your device. Upload your own sheet whenever you are ready.';
    updateBackgroundControls();
    $('#previewStatus').textContent = 'Preparing sample frames…';
    showStepTwo();
    buildProcessedFrames();
  });
  $('#playWithSpriteButton').addEventListener('click', () => {
    showView('play');
    showToast('Meet ' + ($('#heroName').value.trim() || 'your hero') + '!');
  });

  $('#heroName').addEventListener('input', saveSettings);
  $('#heroName').addEventListener('change', () => { $('#heroName').value = $('#heroName').value.trim().slice(0, 18) || 'Pip'; saveSettings(); });

  function hash(x, y, salt = 0) {
    let n = Math.sin((x + salt * 19.17) * 127.1 + (y - salt * 31.77) * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  const world = { width: 112, height: 80, size: 32 };
  function biomeAt(tx, ty) {
    const dx = (tx - 56) / 51, dy = (ty - 40) / 35;
    const edge = Math.sqrt(dx * dx + dy * dy);
    if (edge > 1.035) return 'water';
    const lake = Math.pow((tx - 50) / 8.5, 2) + Math.pow((ty - 45) / 5.8, 2) < 1;
    const riverY = 48 + Math.sin(tx * .17) * 1.25;
    if (lake || (tx > 55 && tx < 74 && Math.abs(ty - riverY) < .72)) return 'water';
    if (edge > .91) return 'beach';
    if (tx < 43 && ty < 27) return 'snow';
    if (tx < 39 && ty < 59) return 'forest';
    if (tx > 67 && ty > 23) return 'desert';
    return 'meadow';
  }
  function obstacleAt(tx, ty) {
    const biome = biomeAt(tx, ty);
    if (biome === 'water' || biome === 'beach') return null;
    if (Math.abs(tx - 56) < 2 && Math.abs(ty - 40) < 2) return null;
    if (idolData.some(idol => Math.abs(tx - idol.tx) <= 1 && Math.abs(ty - idol.ty) <= 1)) return null;
    const value = hash(tx, ty, 4);
    if (biome === 'forest' && value < .15) return { type: 'tree', biome };
    if (biome === 'snow' && value < .1) return { type: 'pine', biome };
    if (biome === 'desert' && value < .055) return { type: 'cactus', biome };
    if (biome === 'meadow' && value < .026) return { type: 'rock', biome };
    return null;
  }

  const ground = {
    meadow: ['#b8d496', '#b4d28f', '#beda9b', '#b1ce8d'],
    forest: ['#82b77c', '#88bb80', '#7eaf75', '#8abb7c'],
    snow: ['#e4eee7', '#e9f0e9', '#dce9e2', '#e8efe9'],
    desert: ['#eac986', '#edcf91', '#e7c37d', '#f0d398'],
    beach: ['#f1d99c', '#eed496', '#f3dda8', '#ecd092'],
    water: ['#7fc2cf', '#78bdcc', '#83c7d2', '#75bacb']
  };
  function drawGround(ctx, tx, ty, sx, sy, time) {
    const type = biomeAt(tx, ty), h = hash(tx, ty, 0);
    const size = world.size;
    ctx.fillStyle = ground[type][Math.floor(h * ground[type].length)];
    ctx.fillRect(sx, sy, size + 1, size + 1);
    if (type === 'water') {
      const phase = (time * .00012 + h * 4) % 1;
      const wx = sx + ((h * 22 + phase * 13) % 24) + 3;
      const wy = sy + ((hash(tx, ty, 2) * 22 + phase * 9) % 24) + 4;
      ctx.fillStyle = 'rgba(228,248,237,.62)';
      ctx.fillRect(wx, wy, 6 + Math.floor(h * 5), 2);
      if (h > .66) { ctx.fillStyle = 'rgba(50,148,174,.2)'; ctx.fillRect(wx - 3, wy + 6, 8, 2); }
    } else if (type === 'beach') {
      for (let i = 0; i < 3; i++) {
        const dot = hash(tx + i * 2, ty - i, 1);
        ctx.fillStyle = i % 2 ? 'rgba(172,143,84,.18)' : 'rgba(255,250,220,.48)';
        ctx.fillRect(sx + 5 + dot * 22, sy + 5 + hash(tx, ty + i, 2) * 23, 2, 2);
      }
    } else {
      const fleck = hash(tx, ty, 8);
      ctx.fillStyle = type === 'snow' ? 'rgba(255,255,255,.53)' : type === 'desert' ? 'rgba(255,250,218,.43)' : 'rgba(237,248,194,.42)';
      ctx.fillRect(sx + 5 + fleck * 23, sy + 4 + hash(tx, ty, 9) * 23, 2, 2);
      if (type === 'meadow' && hash(tx, ty, 12) > .83 && !obstacleAt(tx, ty)) {
        const flower = hash(tx, ty, 13) > .5 ? '#f9efbe' : '#f4c5a1';
        ctx.fillStyle = '#6e9d68'; ctx.fillRect(sx + 15, sy + 17, 2, 6);
        ctx.fillStyle = flower; ctx.fillRect(sx + 12, sy + 14, 7, 5);
        ctx.fillStyle = '#e2bd5c'; ctx.fillRect(sx + 14, sy + 15, 3, 3);
      }
    }
  }

  function drawObstacle(ctx, tx, ty, sx, sy, time) {
    const obstacle = obstacleAt(tx, ty);
    if (!obstacle) return;
    const wobble = Math.sin(time * .0014 + tx * 2 + ty) * .7;
    if (obstacle.type === 'tree') {
      ctx.fillStyle = 'rgba(44,78,50,.18)'; ctx.beginPath(); ctx.ellipse(sx + 17, sy + 27, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#805f42'; ctx.fillRect(sx + 14, sy + 17, 7, 12);
      ctx.fillStyle = '#4d9060'; ctx.beginPath(); ctx.arc(sx + 16, sy + 12 + wobble, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#62a96c'; ctx.beginPath(); ctx.arc(sx + 10, sy + 14 + wobble, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#75b879'; ctx.beginPath(); ctx.arc(sx + 21, sy + 12 + wobble, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(217,242,171,.35)'; ctx.fillRect(sx + 9, sy + 8 + wobble, 5, 3);
    } else if (obstacle.type === 'pine') {
      ctx.fillStyle = 'rgba(67,94,81,.14)'; ctx.beginPath(); ctx.ellipse(sx + 17, sy + 28, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#88a993'; ctx.fillRect(sx + 15, sy + 20, 5, 9);
      ctx.fillStyle = '#628f7d'; ctx.beginPath(); ctx.moveTo(sx + 17, sy + 3 + wobble); ctx.lineTo(sx + 5, sy + 25); ctx.lineTo(sx + 29, sy + 25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8fbaa2'; ctx.beginPath(); ctx.moveTo(sx + 17, sy + 7 + wobble); ctx.lineTo(sx + 8, sy + 19); ctx.lineTo(sx + 26, sy + 19); ctx.closePath(); ctx.fill();
    } else if (obstacle.type === 'cactus') {
      ctx.fillStyle = 'rgba(130,100,53,.18)'; ctx.beginPath(); ctx.ellipse(sx + 18, sy + 28, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4c9b71'; ctx.fillRect(sx + 14, sy + 9, 8, 19); ctx.fillRect(sx + 9, sy + 15, 5, 4); ctx.fillRect(sx + 9, sy + 12, 3, 6); ctx.fillRect(sx + 22, sy + 18, 5, 4); ctx.fillRect(sx + 24, sy + 14, 3, 8);
      ctx.fillStyle = '#8dca8a'; ctx.fillRect(sx + 16, sy + 11, 2, 12);
    } else {
      ctx.fillStyle = '#a9a98b'; ctx.beginPath(); ctx.ellipse(sx + 17, sy + 23, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cbc5a3'; ctx.beginPath(); ctx.ellipse(sx + 14, sy + 20, 5, 3, -.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawIdol(ctx, idol, time) {
    if (defeatedBosses.has(idol.biome) || awakenedIdols.has(idol.biome)) return;
    const sx = idol.tx * world.size - cameraX + world.size / 2;
    const sy = idol.ty * world.size - cameraY + world.size / 2;
    if (sx < -32 || sy < -36 || sx > gameWidth + 32 || sy > gameHeight + 36) return;
    const pulse = Math.sin(time * .004 + idol.tx) * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(53,79,61,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 11, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,250,212,${.42 + (Math.sin(time * .003 + idol.ty) + 1) * .16})`;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 1, 16 + pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,247,191,.76)'; ctx.beginPath(); ctx.ellipse(sx, sy + 7, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(idol.glyph, sx, sy - 3 + pulse * .35);
    ctx.fillStyle = '#fff9d8'; ctx.font = 'bold 8px "DM Sans",sans-serif'; ctx.fillText('✦', sx + 14, sy - 14 - pulse);
    ctx.restore();
  }

  function drawHero(ctx, time) {
    const sx = player.x - cameraX + world.size / 2;
    const sy = player.y - cameraY + world.size / 2;
    if (sx < -60 || sy < -60 || sx > gameWidth + 60 || sy > gameHeight + 60) return;
    const bob = player.moving ? Math.sin(time * .018) * 1.8 : Math.sin(time * .0025) * .7;
    ctx.fillStyle = 'rgba(46,72,49,.21)'; ctx.beginPath(); ctx.ellipse(sx, sy + 11, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    if (player.inWater) {
      ctx.strokeStyle = 'rgba(247,255,231,.72)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(sx, sy + 7, 14 + Math.sin(time * .004) * 1.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
      if (player.slideTimer > 0) {
        ctx.fillStyle = 'rgba(240,255,244,.88)';
        for (let i = 0; i < 3; i++) {
          const drift = 14 + i * 7;
          const bx = sx - player.slideDX * drift + Math.sin(time * .012 + i) * 4;
          const by = sy - player.slideDY * drift + Math.cos(time * .011 + i * 2) * 3;
          ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 2), 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    const pose = player.moving ? 1 + Math.floor(frameTime / 130) % 3 : 0;
    const row = directions[player.face] ?? 2;
    const frame = spriteFrames?.[row * 4 + pose];
    ctx.imageSmoothingEnabled = false;
    if (player.dashTimer > 0) {
      ctx.fillStyle = 'rgba(255,239,171,.48)';
      ctx.beginPath(); ctx.ellipse(sx - player.dashDX * 19, sy - player.dashDY * 19 + 5, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (frame?.complete && frame.naturalWidth) {
      const floatY = player.inWater ? 3 : 0;
      const drawX = Math.round(sx - 18), drawY = Math.round(sy - 23 + bob + floatY);
      if (player.inWater) {
        ctx.save();
        ctx.beginPath(); ctx.rect(drawX, drawY, 36, 19); ctx.clip();
        ctx.drawImage(frame, drawX, drawY, 36, 38);
        ctx.restore();
        ctx.strokeStyle = 'rgba(229,249,230,.88)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(drawX + 2, drawY + 19);
        ctx.quadraticCurveTo(drawX + 10, drawY + 16, drawX + 18, drawY + 19);
        ctx.quadraticCurveTo(drawX + 27, drawY + 22, drawX + 34, drawY + 18);
        ctx.stroke();
      } else ctx.drawImage(frame, drawX, drawY, 36, 38);
    } else {
      ctx.fillStyle = '#71976b'; ctx.fillRect(sx - 9, sy - 13, 18, 22);
    }
    if (player.inWater && hash(Math.floor(player.x / 32), Math.floor(player.y / 32), 44) > .58) {
      ctx.fillStyle = 'rgba(255,255,224,.72)'; ctx.fillRect(sx + 12, sy - 6, 2, 2);
    }
  }

  let cameraX = 0, cameraY = 0;
  function drawEnemy(ctx, enemy, time) {
    const sx = enemy.x - cameraX + world.size / 2;
    const sy = enemy.y - cameraY + world.size / 2;
    if (enemy.role === 'boss') return drawBoss(ctx, enemy, time, sx, sy);
    if (sx < -35 || sy < -35 || sx > gameWidth + 35 || sy > gameHeight + 35) return;
    const bob = Math.sin(time * .006 + enemy.phase) * 1.5;
    ctx.fillStyle = 'rgba(45,74,55,.18)'; ctx.beginPath(); ctx.ellipse(sx, sy + 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = enemy.palette[enemy.color % enemy.palette.length];
    ctx.beginPath(); ctx.ellipse(sx, sy + bob, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 7, sy - 5 + bob); ctx.lineTo(sx - 8, sy - 12 + bob); ctx.lineTo(sx - 2, sy - 7 + bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + 7, sy - 5 + bob); ctx.lineTo(sx + 8, sy - 12 + bob); ctx.lineTo(sx + 2, sy - 7 + bob); ctx.fill();
    ctx.fillStyle = '#fff7e9'; ctx.fillRect(sx - 5, sy - 2 + bob, 3, 4); ctx.fillRect(sx + 2, sy - 2 + bob, 3, 4);
    ctx.fillStyle = '#38473d'; ctx.fillRect(sx - 4, sy - 1 + bob, 2, 3); ctx.fillRect(sx + 3, sy - 1 + bob, 2, 3);
    ctx.strokeStyle = 'rgba(73,67,67,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy + 3 + bob, 2, .15, Math.PI - .15); ctx.stroke();
  }

  function drawBoss(ctx, enemy, time, sx, sy) {
    if (sx < -70 || sy < -75 || sx > gameWidth + 70 || sy > gameHeight + 75) return;
    const [body, accent, shadow] = enemy.palette;
    const bob = Math.sin(time * .004 + enemy.phase) * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(45,74,55,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 18, 27, 8, 0, 0, Math.PI * 2); ctx.fill();
    if (enemy.bossType === 'flower-snake' || enemy.bossType === 'sand-serpent') {
      for (let i = 3; i >= 1; i--) {
        const segmentX = sx - i * 13;
        const segmentY = sy + Math.sin(time * .003 + enemy.phase + i * .8) * 7 + bob;
        ctx.fillStyle = i % 2 ? body : accent;
        ctx.beginPath(); ctx.ellipse(segmentX, segmentY, 10 - i * .7, 9 - i * .5, -.2, 0, Math.PI * 2); ctx.fill();
        if (enemy.bossType === 'sand-serpent') {
          ctx.fillStyle = '#fff0b4'; ctx.fillRect(segmentX - 2, segmentY - 2, 2, 2); ctx.fillRect(segmentX + 3, segmentY - 3, 2, 2);
        }
      }
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(sx + 1, sy + bob, 14, 12, -.12, 0, Math.PI * 2); ctx.fill();
      if (enemy.bossType === 'flower-snake') {
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          ctx.fillStyle = accent; ctx.beginPath(); ctx.ellipse(sx + 1 + Math.cos(angle) * 13, sy - 3 + bob + Math.sin(angle) * 12, 5, 3, angle, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(sx - 5 + i * 9, sy - 8 + bob); ctx.lineTo(sx - 1 + i * 9, sy - 17 + bob); ctx.lineTo(sx + 3 + i * 9, sy - 8 + bob); ctx.fill();
        }
      }
      ctx.fillStyle = '#fff9e8'; ctx.fillRect(sx - 6, sy - 2 + bob, 4, 5); ctx.fillRect(sx + 3, sy - 2 + bob, 4, 5);
      ctx.fillStyle = '#36483d'; ctx.fillRect(sx - 4, sy - 1 + bob, 2, 3); ctx.fillRect(sx + 4, sy - 1 + bob, 2, 3);
      if (enemy.bossType === 'flower-snake') { ctx.fillStyle = '#ed8294'; ctx.fillRect(sx + 1, sy + 8 + bob, 2, 7); }
    } else if (enemy.bossType === 'leaf-dragon' || enemy.bossType === 'ice-dragon') {
      ctx.fillStyle = shadow; ctx.beginPath(); ctx.moveTo(sx - 4, sy + 1 + bob); ctx.lineTo(sx - 30, sy - 20 + bob); ctx.lineTo(sx - 25, sy + 10 + bob); ctx.lineTo(sx - 9, sy + 14 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + 4, sy + 1 + bob); ctx.lineTo(sx + 30, sy - 20 + bob); ctx.lineTo(sx + 25, sy + 10 + bob); ctx.lineTo(sx + 9, sy + 14 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(sx, sy + bob, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.ellipse(sx + 1, sy + 7 + bob, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - 12, sy - 7 + bob); ctx.lineTo(sx - 20, sy - 18 + bob); ctx.lineTo(sx - 6, sy - 12 + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + 12, sy - 7 + bob); ctx.lineTo(sx + 20, sy - 18 + bob); ctx.lineTo(sx + 6, sy - 12 + bob); ctx.fill();
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx + i * 8, sy - 10 + bob); ctx.lineTo(sx + i * 8 + 4, sy - 20 + bob); ctx.lineTo(sx + i * 8 + 8, sy - 10 + bob); ctx.fill(); }
      ctx.fillStyle = '#fff9e8'; ctx.fillRect(sx - 8, sy - 2 + bob, 4, 5); ctx.fillRect(sx + 4, sy - 2 + bob, 4, 5);
      ctx.fillStyle = '#34463d'; ctx.fillRect(sx - 6, sy - 1 + bob, 2, 3); ctx.fillRect(sx + 6, sy - 1 + bob, 2, 3);
    } else {
      ctx.strokeStyle = shadow; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const offset = i * 8;
        ctx.beginPath(); ctx.moveTo(sx + offset, sy + 8 + bob); ctx.quadraticCurveTo(sx + offset + i * 5, sy + 26 + bob, sx + offset + i * 9, sy + 31 + bob); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(sx + offset + i * 9, sy + 31 + bob, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(sx, sy + bob, 21, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(sx - 13, sy - 8 + bob); ctx.lineTo(sx - 8, sy - 25 + bob); ctx.lineTo(sx - 3, sy - 10 + bob); ctx.lineTo(sx + 3, sy - 25 + bob); ctx.lineTo(sx + 10, sy - 9 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff9e8'; ctx.fillRect(sx - 10, sy - 2 + bob, 6, 7); ctx.fillRect(sx + 4, sy - 2 + bob, 6, 7);
      ctx.fillStyle = '#34463d'; ctx.fillRect(sx - 7, sy, 3, 4); ctx.fillRect(sx + 7, sy, 3, 4);
    }
    if (enemy.hitFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.6, enemy.hitFlash * 2)})`; ctx.beginPath(); ctx.arc(sx, sy + bob, 24, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function renderWorld(time) {
    if (!gameWidth || !gameHeight) return;
    cameraX = player.x - gameWidth / 2;
    cameraY = player.y - gameHeight / 2;
    const left = Math.floor(cameraX / world.size) - 1;
    const top = Math.floor(cameraY / world.size) - 1;
    const cols = Math.ceil(gameWidth / world.size) + 3;
    const rows = Math.ceil(gameHeight / world.size) + 3;
    gameCtx.clearRect(0, 0, gameWidth, gameHeight);
    gameCtx.fillStyle = '#73b9cb'; gameCtx.fillRect(0, 0, gameWidth, gameHeight);
    for (let y = top; y < top + rows; y++) for (let x = left; x < left + cols; x++) {
      const sx = Math.floor(x * world.size - cameraX), sy = Math.floor(y * world.size - cameraY);
      drawGround(gameCtx, x, y, sx, sy, time);
      drawObstacle(gameCtx, x, y, sx, sy, time);
    }
    for (const idol of idolData) drawIdol(gameCtx, idol, time);
    for (const enemy of enemies) drawEnemy(gameCtx, enemy, time);
    drawHero(gameCtx, time);
  }

  function resizeGame() {
    if (!gameCanvas || !gameViewport) return;
    const rect = gameViewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gameWidth = rect.width; gameHeight = rect.height;
    gameCanvas.width = Math.round(gameWidth * dpr); gameCanvas.height = Math.round(gameHeight * dpr);
    gameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gameCtx.imageSmoothingEnabled = false;
  }
  if ('ResizeObserver' in window) new ResizeObserver(resizeGame).observe(gameViewport);
  window.addEventListener('resize', resizeGame);

  function collides(x, y) {
    const tx = Math.floor(x / world.size), ty = Math.floor(y / world.size);
    for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
      const o = obstacleAt(xx, yy); if (!o) continue;
      const cx = xx * world.size + 16, cy = yy * world.size + 20;
      const dx = x - cx, dy = y - cy;
      const radius = o.type === 'rock' ? 10 : 11;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }
  function updateEnemyCount() {
    if (!activeBossId) {
      $('#enemyCount').textContent = defeatedBosses.size ? `${defeatedBosses.size}/5 guardians befriended` : 'Find a glowing idol';
      return;
    }
    const minions = enemies.filter(enemy => enemy.role === 'minion').length;
    $('#enemyCount').textContent = `${minions} minion${minions === 1 ? '' : 's'} left · dash to bop`;
  }
  function updateIdolProgress() {
    const count = defeatedBosses.size;
    $('#idolProgressCount').innerHTML = `${count} <small>/ 5</small>`;
    $('#homeIdolProgress').textContent = `${count} of 5 guardians befriended`;
    $('#homeIdolBar').style.width = `${count * 20}%`;
    for (const idol of idolData) {
      const item = $(`[data-idol-progress="${idol.biome}"]`);
      if (!item) continue;
      const complete = defeatedBosses.has(idol.biome);
      const awake = activeBossId === idol.biome || awakenedIdols.has(idol.biome);
      item.classList.toggle('complete', complete);
      item.classList.toggle('awake', awake && !complete);
      item.querySelector('small').textContent = complete ? 'Guardian friend' : awake ? 'Boss awake!' : 'Idol hidden';
    }
  }
  function updateBossHud() {
    const hud = $('#bossStatus');
    const idol = idolData.find(item => item.biome === activeBossId);
    const boss = enemies.find(enemy => enemy.role === 'boss');
    if (!idol) { hud.hidden = true; return; }
    hud.hidden = false;
    $('#bossEmoji').textContent = idol.glyph;
    $('#bossBiome').textContent = `${biomeData[idol.biome].title} · ${idol.bossTitle}`;
    $('#bossName').textContent = boss ? idol.boss : `${idol.boss} is nearly a friend`;
    if (boss) {
      $('#bossHealthBar').style.width = `${Math.max(0, boss.health / boss.maxHealth * 100)}%`;
      $('#bossHealthLabel').textContent = `${boss.health} ${boss.health === 1 ? 'heart' : 'hearts'}`;
    } else {
      $('#bossHealthBar').style.width = '0%';
      $('#bossHealthLabel').textContent = 'Guardian nearly befriended';
    }
  }
  function spawnPosition(index, total, distance) {
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = index / total * Math.PI * 2 + attempt * .61;
      const spread = distance + attempt % 4 * 17;
      const x = clamp(player.x + Math.cos(angle) * spread, 24, world.width * world.size - 24);
      const y = clamp(player.y + Math.sin(angle) * spread, 24, world.height * world.size - 24);
      if (!collides(x, y)) return { x, y };
    }
    return { x: player.x + Math.cos(index * 2.1) * distance, y: player.y + Math.sin(index * 2.1) * distance };
  }
  function startBossFight(idol) {
    if (activeBossId || defeatedBosses.has(idol.biome)) return;
    activeBossId = idol.biome;
    awakenedIdols.add(idol.biome);
    enemies.length = 0;
    for (let i = 0; i < idol.minionCount; i++) {
      const position = spawnPosition(i, idol.minionCount, 84 + (i % 2) * 18);
      enemies.push({ ...position, role: 'minion', bossId: idol.biome, bossType: idol.bossType, palette: idol.palette, color: i, phase: Math.random() * 6, speed: 32 });
    }
    const bossPosition = spawnPosition(idol.minionCount, idol.minionCount + 1, 128);
    enemies.push({ ...bossPosition, role: 'boss', bossId: idol.biome, bossType: idol.bossType, palette: idol.palette, phase: Math.random() * 6, speed: 23, health: 4, maxHealth: 4, hitFlash: 0 });
    nearbyIdolId = '';
    updateIdolProgress(); updateBossHud(); updateEnemyCount();
    showToast(`${idol.title} glows! ${idol.boss} and its ${idol.minions} are here. Dash to befriend them!`);
  }
  function checkIdolPickup() {
    if (activeBossId) return;
    for (const idol of idolData) {
      if (defeatedBosses.has(idol.biome)) continue;
      const distance = Math.hypot(player.x - idol.tx * world.size, player.y - idol.ty * world.size);
      if (distance < 24) { startBossFight(idol); return; }
      if (distance < 58) {
        if (nearbyIdolId !== idol.biome) showToast(`A ${idol.title} is glowing nearby. Walk up to it!`);
        nearbyIdolId = idol.biome;
        return;
      }
    }
    nearbyIdolId = '';
  }
  function finishBossFight() {
    const idol = idolData.find(item => item.biome === activeBossId);
    if (!idol) return;
    defeatedBosses.add(idol.biome);
    awakenedIdols.delete(idol.biome);
    const existing = safeLoad();
    safeSave({ ...existing, defeatedBosses: [...defeatedBosses] });
    activeBossId = null;
    updateIdolProgress(); updateBossHud(); updateEnemyCount();
    showToast(`${idol.boss} is your friend now! You found the ${idol.title}.`);
  }
  function startDash() {
    if (!$('#playView').classList.contains('active') || player.dashCooldown > 0 || player.dashTimer > 0) return;
    let dx = 0, dy = 0;
    if (pressed.has('ArrowLeft') || pressed.has('KeyA')) dx--;
    if (pressed.has('ArrowRight') || pressed.has('KeyD')) dx++;
    if (pressed.has('ArrowUp') || pressed.has('KeyW')) dy--;
    if (pressed.has('ArrowDown') || pressed.has('KeyS')) dy++;
    if (!dx && !dy) {
      if (player.face === 'up') dy = -1;
      else if (player.face === 'down') dy = 1;
      else if (player.face === 'left') dx = -1;
      else dx = 1;
    }
    const length = Math.hypot(dx, dy) || 1;
    player.dashDX = dx / length; player.dashDY = dy / length;
    player.dashTimer = .2; player.dashCooldown = .72;
    player.dashHitBoss = false;
    $('#gameHint').classList.add('gone');
    updateDashButton();
  }
  function updateDashButton() {
    const button = $('#dashButton');
    const cooling = player.dashCooldown > 0 || player.dashTimer > 0;
    button.disabled = cooling;
    button.classList.toggle('dashing', player.dashTimer > 0);
    button.textContent = player.dashTimer > 0 ? '⚡ Go!' : cooling ? '⚡ …' : '⚡ Dash';
    button.title = cooling ? 'Dash is recharging' : 'Dash in the direction you are facing';
  }
  function updateEnemies(dt) {
    for (const enemy of enemies) {
      enemy.phase += dt;
      enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - dt);
      if (enemy.staggerTimer > 0) { enemy.staggerTimer = Math.max(0, enemy.staggerTimer - dt); continue; }
      const dx = player.x - enemy.x, dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 20) continue;
      const step = Math.min(enemy.speed * dt, distance - 19);
      const nextX = enemy.x + dx / distance * step, nextY = enemy.y + dy / distance * step;
      if (!collides(nextX, enemy.y)) enemy.x = nextX;
      if (!collides(enemy.x, nextY)) enemy.y = nextY;
    }
  }
  function bopEnemies() {
    let bopped = 0, bossHits = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const dx = player.x - enemy.x, dy = player.y - enemy.y;
      const reach = enemy.role === 'boss' ? 39 : 29;
      if (dx * dx + dy * dy >= reach * reach) continue;
      if (enemy.role === 'boss') {
        if (player.dashHitBoss) continue;
        player.dashHitBoss = true;
        enemy.health--; enemy.hitFlash = .28; enemy.staggerTimer = .3; bossHits++;
        if (enemy.health <= 0) enemies.splice(i, 1);
      } else {
        enemies.splice(i, 1); bopped++;
      }
    }
    if (!bopped && !bossHits) return;
    updateBossHud(); updateEnemyCount();
    if (enemies.length === 0) finishBossFight();
    else if (bossHits) showToast(`Dash! ${idolData.find(item => item.biome === activeBossId)?.boss} has ${enemies.find(enemy => enemy.role === 'boss')?.health ?? 0} hearts left.`);
    else showToast(bopped === 1 ? 'Boop! One minion ran off.' : `Boop! ${bopped} minions ran off.`);
  }
  function movePlayer(dt) {
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    const dashing = player.dashTimer > 0;
    let dx = 0, dy = 0;
    if (pressed.has('ArrowLeft') || pressed.has('KeyA')) dx -= 1;
    if (pressed.has('ArrowRight') || pressed.has('KeyD')) dx += 1;
    if (pressed.has('ArrowUp') || pressed.has('KeyW')) dy -= 1;
    if (pressed.has('ArrowDown') || pressed.has('KeyS')) dy += 1;
    const hasInput = !!(dx || dy);
    if (dashing) { dx = player.dashDX; dy = player.dashDY; }
    else if (!hasInput && player.inWater && player.slideTimer > 0) { dx = player.slideDX; dy = player.slideDY; }
    player.moving = !!(dx || dy);
    if (!player.moving) { updateDashButton(); return; }
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    const tx = dx * norm, ty = dy * norm;
    if (Math.abs(dx) > Math.abs(dy)) player.face = dx > 0 ? 'right' : 'left';
    else if (dy) player.face = dy > 0 ? 'down' : 'up';
    const speed = dashing ? 365 : player.slideTimer > 0 ? 175 : player.inWater ? 90 : 115;
    const amount = speed * dt;
    const nextX = player.x + tx * amount, nextY = player.y + ty * amount;
    if (!collides(nextX, player.y)) player.x = clamp(nextX, 15, world.width * world.size - 15);
    if (!collides(player.x, nextY)) player.y = clamp(nextY, 15, world.height * world.size - 15);
    frameTime += dt * 1000;
    if (!played) {
      played = true; $('#gameHint').classList.add('gone');
    }
    const nextWater = biomeAt(Math.floor(player.x / 32), Math.floor(player.y / 32)) === 'water';
    let enteredWater = false;
    if (nextWater !== player.inWater) {
      player.inWater = nextWater;
      enteredWater = nextWater;
      if (nextWater) { player.slideTimer = .3; player.slideDX = tx; player.slideDY = ty; }
      else player.slideTimer = 0;
    }
    const biome = biomeAt(Math.floor(player.x / 32), Math.floor(player.y / 32));
    updateBiome(biome);
    if (enteredWater) showToast('You slide into the water! Splash!');
    checkIdolPickup();
    if (dashing) bopEnemies();
    if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);
    if (player.slideTimer > 0 && !enteredWater) player.slideTimer = Math.max(0, player.slideTimer - dt);
    updateDashButton();
  }

  function updateBiome(biome) {
    if (!biomeData[biome]) return;
    const info = biomeData[biome];
    $('#biomeName').textContent = info.title;
    $('.biome-emoji').textContent = info.emoji;
    $('#biomePill').dataset.biome = biome;
    if (lastBiome && biome !== lastBiome) {
      if (['meadow', 'forest', 'snow', 'desert', 'water'].includes(biome) && !found.has(biome)) {
        found.add(biome);
        const item = $(`.discovery-item[data-biome="${biome}"]`);
        item?.classList.add('found');
        $('#discoveryCount').innerHTML = `${found.size} <small>/ 5</small>`;
        $('#discoveryProgress').style.width = `${found.size * 20}%`;
        showToast(info.message);
      } else if (biome === 'beach') showToast(info.message);
    }
    lastBiome = biome;
  }

  function showToast(message) {
    const toast = $('#gameToast');
    toast.textContent = message; toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2300);
  }

  function loop(time) {
    const dt = Math.min(.04, (time - lastTick) / 1000 || 0);
    lastTick = time;
    if ($('#playView').classList.contains('active')) {
      movePlayer(dt);
      updateEnemies(dt);
      renderWorld(time);
      if (soundOn) maybePlayAmbient(time);
    }
    requestAnimationFrame(loop);
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function onKeyDown(event) {
    if (event.key === 'Escape' && pickingBackground) {
      pickingBackground = false; cropStage.classList.remove('sampling');
      $('#pickBackgroundButton').classList.remove('active');
      $('#pickBackgroundButton').querySelector('span').textContent = 'Pick background';
      updateBackgroundControls();
      return;
    }
    if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.code;
    if ($('#playView').classList.contains('active') && ['Space', 'ShiftLeft', 'ShiftRight'].includes(key)) {
      event.preventDefault(); startDash(); return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key) && $('#playView').classList.contains('active')) {
      event.preventDefault(); pressed.add(key);
    }
  }
  function onKeyUp(event) { pressed.delete(event.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => pressed.clear());
  $$('.pad-key').forEach(button => {
    const key = button.dataset.key;
    const down = event => { event.preventDefault(); pressed.add(key); button.classList.add('held'); };
    const up = event => { event.preventDefault(); pressed.delete(key); button.classList.remove('held'); };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  $('#restartButton').addEventListener('click', () => {
    if (activeBossId) awakenedIdols.delete(activeBossId);
    activeBossId = null;
    nearbyIdolId = '';
    player.x = 56 * 32; player.y = 40 * 32; player.face = 'down'; player.inWater = false;
    player.slideTimer = 0; player.dashTimer = 0; player.dashCooldown = 0; player.dashHitBoss = false; enemies.length = 0;
    lastBiome = ''; updateBiome('meadow'); pressed.clear();
    updateIdolProgress(); updateBossHud(); updateEnemyCount(); updateDashButton();
    showToast('Back in the sunny meadow.');
  });
  $('#dashButton').addEventListener('click', startDash);

  // Optional sound is synthesized locally: a few gentle, short notes, with no downloaded audio.
  function playNote(frequency, duration, volume) {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + .035);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration + .025);
    } catch { /* Browser audio can be unavailable; the game itself is unaffected. */ }
  }
  function maybePlayAmbient(time) {
    if (time < randomSoundTimer) return;
    randomSoundTimer = time + 5500 + hash(Math.floor(time / 1000), 2, 7) * 5000;
    const inForest = biomeAt(Math.floor(player.x / 32), Math.floor(player.y / 32)) === 'forest';
    playNote(inForest ? 760 : 570, .32, .022);
    if (inForest) window.setTimeout(() => playNote(920, .22, .015), 130);
  }
  $('#soundToggle').addEventListener('click', () => {
    soundOn = !soundOn;
    $('#soundToggle').classList.toggle('on', soundOn);
    $('#soundToggle').title = soundOn ? 'Turn off gentle sounds' : 'Turn on gentle sounds';
    $('#soundToggle').setAttribute('aria-label', soundOn ? 'Turn off gentle sounds' : 'Turn on gentle sounds');
    if (soundOn) { playNote(660, .22, .025); randomSoundTimer = performance.now() + 4200; }
  });

  createGrid();
  restoreSprite();
  resizeGame();
  updateBiome('meadow');
  updateIdolProgress(); updateBossHud(); updateEnemyCount(); updateDashButton();
  requestAnimationFrame(loop);
})();
