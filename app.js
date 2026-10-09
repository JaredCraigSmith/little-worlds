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
  const FINAL_BOSS_ID = 'final';
  const finalBossData = { tx: 56, ty: 40, glyph: '🌟', boss: 'Island Titan', bossTitle: 'ancient island guardian', bossType: 'island-titan', palette: ['#75658e', '#f1cb6c', '#4d4561'] };

  const gameCanvas = $('#gameCanvas');
  const gameCtx = gameCanvas.getContext('2d');
  const portraitCanvas = $('#portraitCanvas');
  const portraitCtx = portraitCanvas.getContext('2d');
  const cropCanvas = $('#cropCanvas');
  const cropCtx = cropCanvas.getContext('2d');
  const cropStage = $('#cropStage');
  const cropOverlay = $('#cropOverlay');
  const gameViewport = $('#gameViewport');
  const maxPlayerHealth = 3;
  const playerHealthRegenDelay = 5, playerHealthRegenInterval = 4;
  const finalCinematicDuration = 4.8;
  const player = { x: 56 * 32, y: 40 * 32, face: 'down', walkTime: 0, moving: false, inWater: false, health: maxPlayerHealth, damageCooldown: 0, healthRegenTimer: 0, partyDancing: false, slideTimer: 0, slideDX: 0, slideDY: 1, ridingSlide: false, slideProgress: 0, dolphinRideTimer: 0, sharkScareCooldown: 0, panicTimer: 0, panicDX: 1, panicDY: 0, dashTimer: 0, dashCooldown: 0, dashDX: 0, dashDY: 1, dashHitBoss: false };
  const pressed = new Set();
  const enemies = [];
  const chickens = [];
  const found = new Set(['meadow']);
  const defeatedBosses = new Set();
  const awakenedIdols = new Set();
  const confettiParticles = [];
  let finalBossDefeated = false;
  let finalCinematicTimer = 0;
  let finalCinematicPhase = -1;
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
  let partyNoteTimer = 0;
  let partyNoteIndex = 0;

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
    finalBossDefeated = data.finalBossDefeated === true;
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
    $('#victoryBanner').hidden = !finalBossDefeated;
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
  const waterSlide = {
    points: [[53, 34], [53, 35], [54, 36], [55, 37], [55, 38], [54, 39], [53, 40], [52, 41], [51, 42]]
      .map(([tx, ty]) => ({ x: tx * world.size, y: ty * world.size }))
  };
  const danceParty = { left: 79, right: 83, top: 39, bottom: 42 };
  const partyColors = ['#f37ca2', '#ffd36a', '#76d8c5', '#9b8bf3', '#a6dc72'];
  const soccerField = { left: 27, right: 35, top: 38, bottom: 42, goalHalf: 38 };
  const dolphin = { x: 110 * world.size + world.size / 2, y: 40 * world.size + world.size / 2 };
  const dolphinRideDuration = 10;
  const shark = { x: world.size * .875, y: 40 * world.size + world.size / 2, homeX: world.size * .875, homeY: 40 * world.size + world.size / 2, chasing: false };
  const sharkFearRadius = 180;
  const soccerBall = {
    x: (soccerField.left + soccerField.right + 1) * world.size / 2,
    y: (soccerField.top + soccerField.bottom + 1) * world.size / 2,
    vx: 0, vy: 0, radius: 8, resetTimer: 0
  };
  let soccerGoals = 0;
  let soccerFieldWasActive = false;
  function isDancePartyTile(tx, ty) {
    return tx >= danceParty.left && tx <= danceParty.right && ty >= danceParty.top && ty <= danceParty.bottom;
  }
  function soccerBounds() {
    return {
      left: soccerField.left * world.size,
      right: (soccerField.right + 1) * world.size,
      top: soccerField.top * world.size,
      bottom: (soccerField.bottom + 1) * world.size
    };
  }
  function isPlayerOnSoccerField() {
    const bounds = soccerBounds(), x = player.x + world.size / 2, y = player.y + world.size / 2;
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }
  function isSoccerBallInReach() {
    const x = player.x + world.size / 2, y = player.y + world.size / 2;
    return Math.hypot(soccerBall.x - x, soccerBall.y - y) <= 48;
  }
  function isDolphinInReach() {
    const x = player.x + world.size / 2, y = player.y + world.size / 2;
    return Math.hypot(dolphin.x - x, dolphin.y - y) <= 72;
  }
  function updatePlayerHealth() {
    $('#healthHearts').textContent = `${'♥ '.repeat(player.health)}${'♡ '.repeat(maxPlayerHealth - player.health)}`.trim();
    $('#playerHealth').setAttribute('aria-label', `Player health: ${player.health} of ${maxPlayerHealth} hearts`);
    $('#playerHealth').classList.toggle('low-health', player.health === 1);
  }
  function updatePlayerHealthRegeneration(dt) {
    if (player.health >= maxPlayerHealth) { player.healthRegenTimer = 0; return; }
    player.healthRegenTimer = Math.max(0, player.healthRegenTimer - dt);
    if (player.healthRegenTimer > 0) return;
    player.health++;
    updatePlayerHealth();
    player.healthRegenTimer = player.health < maxPlayerHealth ? playerHealthRegenInterval : 0;
    showToast(`You recovered a heart. ${player.health} of ${maxPlayerHealth} hearts.`);
  }
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
    if (waterSlide.points.some(point => Math.abs(tx - Math.floor(point.x / world.size)) <= 1 && Math.abs(ty - Math.floor(point.y / world.size)) <= 1)) return null;
    if (tx >= danceParty.left - 1 && tx <= danceParty.right + 1 && ty >= danceParty.top - 1 && ty <= danceParty.bottom + 1) return null;
    if (tx >= soccerField.left - 1 && tx <= soccerField.right + 1 && ty >= soccerField.top - 1 && ty <= soccerField.bottom + 1) return null;
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

  function traceWaterSlide(ctx, cameraX, cameraY) {
    const points = waterSlide.points.map(point => ({ x: point.x - cameraX + world.size / 2, y: point.y - cameraY + world.size / 2 }));
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const midpointX = (points[i].x + points[i + 1].x) / 2;
      const midpointY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midpointX, midpointY);
    }
    ctx.lineTo(points.at(-1).x, points.at(-1).y);
    return points;
  }

  function drawWaterSlide(ctx, time) {
    ctx.save();
    let points = traceWaterSlide(ctx, cameraX, cameraY);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(48,72,58,.18)'; ctx.lineWidth = 39; ctx.stroke();
    points = traceWaterSlide(ctx, cameraX, cameraY);
    ctx.strokeStyle = '#778f7e'; ctx.lineWidth = 35; ctx.stroke();
    points = traceWaterSlide(ctx, cameraX, cameraY);
    ctx.strokeStyle = '#eee2b8'; ctx.lineWidth = 29; ctx.stroke();
    points = traceWaterSlide(ctx, cameraX, cameraY);
    ctx.strokeStyle = '#65bdc8'; ctx.lineWidth = 21; ctx.stroke();
    points = traceWaterSlide(ctx, cameraX, cameraY);
    ctx.setLineDash([7, 10]); ctx.strokeStyle = 'rgba(228,251,231,.78)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);

    const start = points[0], end = points.at(-1);
    ctx.fillStyle = '#9a7650'; ctx.fillRect(start.x - 18, start.y - 18, 36, 7);
    ctx.fillStyle = '#d1ae72'; ctx.fillRect(start.x - 15, start.y - 17, 30, 3);
    ctx.fillStyle = '#fffefa'; ctx.fillRect(start.x - 26, start.y - 36, 52, 14);
    ctx.fillStyle = '#4d7257'; ctx.font = 'bold 8px "DM Sans",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('WHEE! ↓', start.x, start.y - 29);
    const ripple = 11 + Math.sin(time * .006) * 2;
    ctx.strokeStyle = 'rgba(233,255,232,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(end.x, end.y + 3, ripple + 6, ripple * .42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(end.x, end.y + 3, ripple, ripple * .3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f2ffe0';
    for (let i = 0; i < 3; i++) {
      const sparkle = time * .002 + i * 2.1;
      ctx.beginPath(); ctx.arc(end.x + Math.cos(sparkle) * (12 + i * 3), end.y + Math.sin(sparkle) * 6, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawDanceParty(ctx, time) {
    const x = danceParty.left * world.size - cameraX;
    const y = danceParty.top * world.size - cameraY;
    const width = (danceParty.right - danceParty.left + 1) * world.size;
    const height = (danceParty.bottom - danceParty.top + 1) * world.size;
    ctx.save();
    ctx.fillStyle = 'rgba(56,59,76,.25)'; ctx.fillRect(x - 5, y - 5, width + 10, height + 10);
    ctx.fillStyle = '#725984'; ctx.fillRect(x - 4, y - 4, width + 8, height + 8);
    ctx.fillStyle = '#f8e9bf'; ctx.fillRect(x, y, width, height);
    for (let row = danceParty.top; row <= danceParty.bottom; row++) for (let col = danceParty.left; col <= danceParty.right; col++) {
      const phase = Math.floor(time / 190);
      const color = partyColors[(col + row + phase) % partyColors.length];
      const pulse = .72 + (Math.sin(time * .006 + col * 1.7 + row) + 1) * .14;
      ctx.globalAlpha = pulse; ctx.fillStyle = color;
      ctx.fillRect(col * world.size - cameraX + 3, row * world.size - cameraY + 3, world.size - 6, world.size - 6);
      ctx.globalAlpha = .35; ctx.fillStyle = '#fff9eb';
      ctx.fillRect(col * world.size - cameraX + 6, row * world.size - cameraY + 6, 5, 3);
    }
    ctx.globalAlpha = 1;
    const centerX = x + width / 2, centerY = y + height / 2;
    for (let i = 0; i < 4; i++) {
      const angle = time * .0015 + i * Math.PI / 2;
      const px = centerX + Math.cos(angle) * (width * .48);
      const py = centerY + Math.sin(angle) * (height * .62);
      ctx.fillStyle = partyColors[i]; ctx.beginPath(); ctx.arc(px, py, 3 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
    // Tiny speakers and a sign make the dance floor easy to spot from the meadow.
    for (const speakerX of [x - 13, x + width + 5]) {
      ctx.fillStyle = '#4d465e'; ctx.fillRect(speakerX, y + height / 2 - 14, 9, 28);
      ctx.fillStyle = '#d5b8ed'; ctx.beginPath(); ctx.arc(speakerX + 4.5, y + height / 2 - 6, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(speakerX + 4.5, y + height / 2 + 7, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff9e9'; ctx.fillRect(centerX - 47, y - 23, 94, 16);
    ctx.fillStyle = '#684d77'; ctx.font = 'bold 9px "DM Sans",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♪ DANCE PARTY ♫', centerX, y - 15);
    ctx.restore();
  }

  function drawSoccerBall(ctx, time) {
    const sx = soccerBall.x - cameraX, sy = soccerBall.y - cameraY;
    if (sx < -20 || sy < -20 || sx > gameWidth + 20 || sy > gameHeight + 20) return;
    const bob = Math.min(1.2, Math.hypot(soccerBall.vx, soccerBall.vy) / 260) * Math.abs(Math.sin(time * .018));
    ctx.fillStyle = 'rgba(39,59,45,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 7, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fffdf4'; ctx.beginPath(); ctx.arc(sx, sy - bob, soccerBall.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#55645b'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#35433c'; ctx.beginPath(); ctx.arc(sx, sy - bob, 2.4, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
      ctx.beginPath(); ctx.arc(sx + Math.cos(angle) * 5, sy - bob + Math.sin(angle) * 5, 1.25, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSoccerField(ctx, time) {
    const bounds = soccerBounds();
    const left = bounds.left - cameraX, right = bounds.right - cameraX;
    const top = bounds.top - cameraY, bottom = bounds.bottom - cameraY;
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    const width = right - left, height = bottom - top, goalTop = centerY - soccerField.goalHalf, goalBottom = centerY + soccerField.goalHalf;
    ctx.save();
    ctx.fillStyle = 'rgba(47,72,52,.26)'; ctx.fillRect(left - 4, top - 4, width + 8, height + 8);
    ctx.fillStyle = '#388152'; ctx.fillRect(left, top, width, height);
    for (let i = 0; i < soccerField.right - soccerField.left + 1; i += 2) {
      ctx.fillStyle = 'rgba(165,220,142,.18)'; ctx.fillRect(left + i * world.size, top, Math.min(2, soccerField.right - soccerField.left + 1 - i) * world.size, height);
    }
    ctx.strokeStyle = 'rgba(248,255,232,.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
    ctx.moveTo(left, top); ctx.lineTo(left, goalTop); ctx.moveTo(left, goalBottom); ctx.lineTo(left, bottom);
    ctx.moveTo(right, top); ctx.lineTo(right, goalTop); ctx.moveTo(right, goalBottom); ctx.lineTo(right, bottom);
    ctx.moveTo(centerX, top); ctx.lineTo(centerX, bottom); ctx.stroke();
    ctx.beginPath(); ctx.arc(centerX, centerY, 23, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(left, centerY - 42, 38, 84); ctx.strokeRect(right - 38, centerY - 42, 38, 84);
    for (const goalX of [left - 17, right]) {
      ctx.fillStyle = 'rgba(255,250,230,.42)'; ctx.fillRect(goalX, goalTop, 17, goalBottom - goalTop);
      ctx.strokeStyle = '#fff9e9'; ctx.lineWidth = 2; ctx.strokeRect(goalX, goalTop, 17, goalBottom - goalTop);
      ctx.strokeStyle = 'rgba(255,255,245,.55)'; ctx.lineWidth = 1;
      for (let y = goalTop + 8; y < goalBottom; y += 10) { ctx.beginPath(); ctx.moveTo(goalX, y); ctx.lineTo(goalX + 17, y); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(goalX + 6, goalTop); ctx.lineTo(goalX + 6, goalBottom); ctx.moveTo(goalX + 12, goalTop); ctx.lineTo(goalX + 12, goalBottom); ctx.stroke();
    }
    ctx.fillStyle = '#fff9e9'; ctx.fillRect(centerX - 66, top - 23, 132, 16);
    ctx.fillStyle = '#396349'; ctx.font = 'bold 8px "DM Sans",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FOREST SOCCER · F TO KICK', centerX, top - 15);
    const light = .72 + (Math.sin(time * .004) + 1) * .12;
    ctx.globalAlpha = light; ctx.fillStyle = '#fff1a4';
    ctx.beginPath(); ctx.arc(centerX, centerY, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    drawSoccerBall(ctx, time);
    ctx.restore();
  }

  function drawFinalIdol(ctx, time) {
    if (defeatedBosses.size !== idolData.length || finalBossDefeated || activeBossId === FINAL_BOSS_ID) return;
    const sx = finalBossData.tx * world.size - cameraX + world.size / 2;
    const sy = finalBossData.ty * world.size - cameraY + world.size / 2;
    if (sx < -56 || sy < -64 || sx > gameWidth + 56 || sy > gameHeight + 64) return;
    const pulse = Math.sin(time * .003) * 4;
    ctx.save();
    ctx.fillStyle = 'rgba(53,79,61,.24)'; ctx.beginPath(); ctx.ellipse(sx, sy + 18, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,238,157,${.48 + (Math.sin(time * .0025) + 1) * .16})`;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 34 + pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,229,.82)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 25 - pulse * .35, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,228,133,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy + 10, 23, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = '42px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(finalBossData.glyph, sx, sy - 4 + pulse * .3);
    ctx.fillStyle = '#fff9d8'; ctx.font = '900 9px "DM Sans",sans-serif'; ctx.fillText('GIANT IDOL', sx, sy + 39);
    ctx.restore();
  }

  function drawDolphin(ctx, time) {
    const riding = player.dolphinRideTimer > 0;
    const worldX = riding ? player.x + world.size / 2 : dolphin.x;
    const worldY = riding ? player.y + world.size / 2 : dolphin.y;
    const sx = worldX - cameraX, sy = worldY - cameraY;
    if (sx < -50 || sy < -50 || sx > gameWidth + 50 || sy > gameHeight + 50) return;
    const direction = riding ? ({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[player.face] ?? 0) : Math.PI;
    const bob = Math.sin(time * .008) * 1.5;
    ctx.save();
    if (!riding) {
      ctx.fillStyle = 'rgba(39,72,76,.18)'; ctx.beginPath(); ctx.ellipse(sx, sy + 12, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(sx, sy + bob); ctx.rotate(direction);
    ctx.fillStyle = '#438c9a'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-31, -9); ctx.lineTo(-27, 0); ctx.lineTo(-31, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#62bdca'; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-15, -10, 4, -9); ctx.quadraticCurveTo(18, -8, 26, 0); ctx.quadraticCurveTo(18, 8, 3, 9); ctx.quadraticCurveTo(-15, 8, -22, 0); ctx.fill();
    ctx.fillStyle = '#d9f1e8'; ctx.beginPath(); ctx.moveTo(-13, 4); ctx.quadraticCurveTo(2, 12, 19, 3); ctx.quadraticCurveTo(8, 8, -13, 4); ctx.fill();
    ctx.fillStyle = '#438c9a'; ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(1, -17); ctx.lineTo(7, -7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(5, 13); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.arc(17, -3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#30434a'; ctx.beginPath(); ctx.arc(17.5, -3, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (!riding) {
      ctx.fillStyle = 'rgba(255,254,246,.92)'; ctx.fillRect(sx - 56, sy - 28, 112, 15);
      ctx.fillStyle = '#456f76'; ctx.font = 'bold 8px "DM Sans",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('E · FAST DOLPHIN RIDE', sx, sy - 20);
    }
  }

  function sharkPosition(time) {
    return { x: shark.x, y: shark.y + Math.sin(time * .0022) * 13 };
  }

  function drawShark(ctx, time) {
    const position = sharkPosition(time);
    const sx = position.x - cameraX, sy = position.y - cameraY;
    if (sx < -60 || sy < -60 || sx > gameWidth + 60 || sy > gameHeight + 60) return;
    ctx.save();
    ctx.fillStyle = 'rgba(37,72,83,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 12, 23, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#466e7c'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-34, -11); ctx.lineTo(-29, 0); ctx.lineTo(-34, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6f9aaa'; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.quadraticCurveTo(-14, -12, 5, -10); ctx.quadraticCurveTo(19, -8, 28, 0); ctx.quadraticCurveTo(18, 8, 4, 10); ctx.quadraticCurveTo(-15, 9, -24, 0); ctx.fill();
    ctx.fillStyle = '#d9e9e5'; ctx.beginPath(); ctx.moveTo(-13, 4); ctx.quadraticCurveTo(2, 12, 20, 3); ctx.quadraticCurveTo(8, 8, -13, 4); ctx.fill();
    ctx.fillStyle = '#466e7c'; ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(1, -21); ctx.lineTo(9, -7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(5, 14); ctx.lineTo(11, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.arc(18, -3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263a41'; ctx.beginPath(); ctx.arc(18.5, -3, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,254,246,.92)'; ctx.fillRect(sx - 51, sy - 34, 102, 15);
    ctx.fillStyle = '#456f76'; ctx.font = 'bold 8px "DM Sans",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SHARK · KEEP BACK', sx, sy - 26);
  }

  function updateShark(dt, time) {
    player.sharkScareCooldown = Math.max(0, player.sharkScareCooldown - dt);
    const position = sharkPosition(time);
    const playerX = player.x + world.size / 2, playerY = player.y + world.size / 2;
    const playerInWater = biomeAt(Math.floor(player.x / world.size), Math.floor(player.y / world.size)) === 'water';
    if (shark.chasing && !playerInWater && player.panicTimer <= 0) shark.chasing = false;
    if (!shark.chasing && playerInWater && player.sharkScareCooldown <= 0 && Math.hypot(playerX - position.x, playerY - position.y) < sharkFearRadius) {
      shark.chasing = true;
      player.panicTimer = 4;
      player.panicDX = 1; player.panicDY = 0; player.face = 'right';
      player.dashTimer = 0; player.dashCooldown = 0; player.dolphinRideTimer = 0; player.sharkScareCooldown = 2;
      pressed.clear();
      updateDashButton(); updateDolphinHud();
      showToast('A shark is chasing you! Run to the west shore!');
    }

    const targetX = shark.chasing ? playerX : shark.homeX;
    const targetY = shark.chasing ? playerY : shark.homeY;
    const dx = targetX - shark.x, dy = targetY - shark.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    const step = Math.min((shark.chasing ? 145 : 70) * dt, distance);
    const candidates = [
      { x: shark.x + dx / distance * step, y: shark.y + dy / distance * step },
      { x: shark.x + Math.sign(dx) * Math.min(step, Math.abs(dx)), y: shark.y },
      { x: shark.x, y: shark.y + Math.sign(dy) * Math.min(step, Math.abs(dy)) }
    ];
    const waterPosition = candidates.find(point => biomeAt(Math.floor(point.x / world.size), Math.floor(point.y / world.size)) === 'water');
    if (waterPosition) { shark.x = waterPosition.x; shark.y = waterPosition.y; }
  }

  function updateSoccerBall(dt) {
    if (soccerBall.resetTimer > 0) {
      soccerBall.resetTimer = Math.max(0, soccerBall.resetTimer - dt);
      return;
    }
    if (Math.abs(soccerBall.vx) < 1 && Math.abs(soccerBall.vy) < 1) return;
    const bounds = soccerBounds();
    const previousX = soccerBall.x, previousY = soccerBall.y;
    soccerBall.x += soccerBall.vx * dt; soccerBall.y += soccerBall.vy * dt;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const goalOpening = soccerField.goalHalf - soccerBall.radius;
    if (soccerBall.x - soccerBall.radius <= bounds.left) {
      const crossingX = bounds.left + soccerBall.radius;
      const crossingT = previousX === soccerBall.x ? 0 : clamp((crossingX - previousX) / (soccerBall.x - previousX), 0, 1);
      const crossingY = previousY + (soccerBall.y - previousY) * crossingT;
      if (soccerBall.vx < 0 && Math.abs(crossingY - centerY) <= goalOpening) return scoreSoccerGoal();
      soccerBall.x = bounds.left + soccerBall.radius; soccerBall.vx = Math.abs(soccerBall.vx) * .68;
    } else if (soccerBall.x + soccerBall.radius >= bounds.right) {
      const crossingX = bounds.right - soccerBall.radius;
      const crossingT = previousX === soccerBall.x ? 0 : clamp((crossingX - previousX) / (soccerBall.x - previousX), 0, 1);
      const crossingY = previousY + (soccerBall.y - previousY) * crossingT;
      if (soccerBall.vx > 0 && Math.abs(crossingY - centerY) <= goalOpening) return scoreSoccerGoal();
      soccerBall.x = bounds.right - soccerBall.radius; soccerBall.vx = -Math.abs(soccerBall.vx) * .68;
    }
    if (soccerBall.y - soccerBall.radius <= bounds.top) {
      soccerBall.y = bounds.top + soccerBall.radius; soccerBall.vy = Math.abs(soccerBall.vy) * .68;
    } else if (soccerBall.y + soccerBall.radius >= bounds.bottom) {
      soccerBall.y = bounds.bottom - soccerBall.radius; soccerBall.vy = -Math.abs(soccerBall.vy) * .68;
    }
    const friction = Math.pow(.994, dt * 60);
    soccerBall.vx *= friction; soccerBall.vy *= friction;
    if (Math.abs(soccerBall.vx) < 7) soccerBall.vx = 0;
    if (Math.abs(soccerBall.vy) < 7) soccerBall.vy = 0;
  }

  function scoreSoccerGoal() {
    soccerGoals++;
    soccerBall.x = (soccerField.left + soccerField.right + 1) * world.size / 2;
    soccerBall.y = (soccerField.top + soccerField.bottom + 1) * world.size / 2;
    soccerBall.vx = 0; soccerBall.vy = 0; soccerBall.resetTimer = .65;
    showToast(`GOAL! ${soccerGoals} ${soccerGoals === 1 ? 'goal' : 'goals'} scored!`);
    if (soundOn) playNote(880, .28, .045);
  }

  function kickSoccerBall() {
    if (!$('#playView').classList.contains('active') || !isPlayerOnSoccerField()) return;
    if (!isSoccerBallInReach()) { showToast('Move closer to the ball before you kick!'); return; }
    const vectors = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
    const [dx, dy] = vectors[player.face] || vectors.down;
    soccerBall.vx = dx * 420; soccerBall.vy = dy * 420;
    showToast('Kick! Face left or right to shoot at a goal.');
  }

  function updateSoccerHud() {
    const onField = isPlayerOnSoccerField();
    const button = $('#soccerKickButton');
    button.hidden = !onField;
    button.disabled = !isSoccerBallInReach();
    button.title = button.disabled ? 'Move close to the ball to kick' : 'Face left or right and press F or Kick to shoot at a goal';
    if (onField) {
      $('#enemyCount').textContent = `⚽ ${soccerGoals} ${soccerGoals === 1 ? 'goal' : 'goals'}`;
      if (!soccerFieldWasActive) showToast('Soccer time! Get close to the ball and press F or Kick.');
    } else if (soccerFieldWasActive) updateEnemyCount();
    soccerFieldWasActive = onField;
  }

  function startDolphinRide() {
    if (!$('#playView').classList.contains('active') || player.ridingSlide || player.panicTimer > 0 || player.dolphinRideTimer > 0 || !isDolphinInReach()) return;
    player.x = dolphin.x - world.size / 2;
    player.y = dolphin.y - world.size / 2;
    player.dolphinRideTimer = dolphinRideDuration;
    player.inWater = biomeAt(Math.floor(player.x / world.size), Math.floor(player.y / world.size)) === 'water';
    player.partyDancing = false;
    $('#gameHint').classList.add('gone');
    showToast('Hold a direction to ride the dolphin fast! 10 seconds.');
    updateDashButton();
    updateDolphinHud();
  }

  function updateDolphinHud() {
    const button = $('#dolphinRideButton');
    const riding = player.dolphinRideTimer > 0;
    button.hidden = !riding && !isDolphinInReach();
    button.disabled = riding;
    button.textContent = riding ? `🐬 ${Math.ceil(player.dolphinRideTimer)}s` : '🐬 Ride (E)';
    button.title = riding ? 'The dolphin ride ends after 10 seconds' : 'Ride the fast dolphin for 10 seconds (E)';
  }

  function hurtPlayer() {
    if (player.health <= 0) return false;
    if (player.damageCooldown > 0 || player.dashTimer > 0) return true;
    player.health = Math.max(0, player.health - 1);
    player.damageCooldown = 1.1;
    player.healthRegenTimer = playerHealthRegenDelay;
    updatePlayerHealth();
    if (player.health === 0) {
      resetGame('You ran out of hearts. Back in the sunny meadow!');
      return false;
    }
    showToast(`Ouch! ${player.health} hearts left.`);
    return true;
  }

  function drawHero(ctx, time) {
    const sx = player.x - cameraX + world.size / 2;
    const sy = player.y - cameraY + world.size / 2;
    if (sx < -60 || sy < -60 || sx > gameWidth + 60 || sy > gameHeight + 60) return;
    ctx.save();
    if (player.damageCooldown > 0 && Math.floor(time / 95) % 2 === 0) ctx.globalAlpha = .42;
    const dancing = player.partyDancing;
    const bob = dancing ? Math.sin(time * .018) * 2.5 + Math.abs(Math.sin(time * .012)) * 2 : player.moving ? Math.sin(time * .018) * 1.8 : Math.sin(time * .0025) * .7;
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
    const pose = dancing ? 1 + Math.floor(time / 130) % 3 : player.moving ? 1 + Math.floor(frameTime / 130) % 3 : 0;
    const danceDirection = ['down', 'left', 'up', 'right'][Math.floor(time / 360) % 4];
    const row = directions[dancing ? danceDirection : player.face] ?? 2;
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
    if (dancing) {
      ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        const angle = time * .004 + i * Math.PI / 2;
        ctx.fillStyle = partyColors[i];
        ctx.fillText(i % 2 ? '♪' : '✦', sx + Math.cos(angle) * 22, sy - 7 + Math.sin(angle) * 15);
      }
      ctx.restore();
    }
    if (player.panicTimer > 0) {
      const markerY = sy - 37 + Math.sin(time * .025) * 2;
      ctx.save(); ctx.fillStyle = '#fff3cf'; ctx.strokeStyle = '#a95c45'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, markerY, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a34837'; ctx.font = '900 14px Nunito,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', sx, markerY);
      ctx.restore();
    }
    ctx.restore();
  }

  let cameraX = 0, cameraY = 0;
  function drawEnemy(ctx, enemy, time) {
    const sx = enemy.x - cameraX + world.size / 2;
    const sy = enemy.y - cameraY + world.size / 2;
    if (enemy.role === 'boss' || enemy.guardianForm) return drawBoss(ctx, enemy, time, sx, sy);
    if (sx < -35 || sy < -35 || sx > gameWidth + 35 || sy > gameHeight + 35) return;
    const bob = Math.sin(time * .006 + enemy.phase) * 1.5;
    ctx.save();
    if (enemy.knockbackTimer > 0) { ctx.translate(sx, sy); ctx.rotate(enemy.knockbackAngle || 0); ctx.translate(-sx, -sy); }
    ctx.fillStyle = 'rgba(45,74,55,.18)'; ctx.beginPath(); ctx.ellipse(sx, sy + 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = enemy.palette[enemy.color % enemy.palette.length];
    ctx.beginPath(); ctx.ellipse(sx, sy + bob, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 7, sy - 5 + bob); ctx.lineTo(sx - 8, sy - 12 + bob); ctx.lineTo(sx - 2, sy - 7 + bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + 7, sy - 5 + bob); ctx.lineTo(sx + 8, sy - 12 + bob); ctx.lineTo(sx + 2, sy - 7 + bob); ctx.fill();
    ctx.fillStyle = '#fff7e9'; ctx.fillRect(sx - 5, sy - 2 + bob, 3, 4); ctx.fillRect(sx + 2, sy - 2 + bob, 3, 4);
    ctx.fillStyle = '#38473d'; ctx.fillRect(sx - 4, sy - 1 + bob, 2, 3); ctx.fillRect(sx + 3, sy - 1 + bob, 2, 3);
    ctx.strokeStyle = 'rgba(73,67,67,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy + 3 + bob, 2, .15, Math.PI - .15); ctx.stroke();
    ctx.restore();
  }

  function drawBoss(ctx, enemy, time, sx, sy) {
    const introEase = enemy.introProgress === undefined ? 1 : enemy.introProgress * enemy.introProgress * (3 - 2 * enemy.introProgress);
    const scale = (enemy.bossScale || 1) * (.08 + .92 * introEase), margin = 70 * scale;
    if (sx < -margin || sy < -margin - 5 || sx > gameWidth + margin || sy > gameHeight + margin + 5) return;
    const [body, accent, shadow] = enemy.palette;
    const bob = Math.sin(time * .004 + enemy.phase) * 2;
    ctx.save();
    if (scale !== 1 || enemy.knockbackTimer > 0) {
      ctx.translate(sx, sy);
      if (enemy.knockbackTimer > 0) ctx.rotate(enemy.knockbackAngle || 0);
      ctx.scale(scale, scale); ctx.translate(-sx, -sy);
    }
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
      if (enemy.enraged) {
        ctx.strokeStyle = 'rgba(238,75,75,.2)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(sx, sy + bob, 31, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = shadow; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const offset = i * 8;
        ctx.beginPath(); ctx.moveTo(sx + offset, sy + 8 + bob); ctx.quadraticCurveTo(sx + offset + i * 5, sy + 26 + bob, sx + offset + i * 9, sy + 31 + bob); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(sx + offset + i * 9, sy + 31 + bob, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(sx, sy + bob, 21, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(sx - 13, sy - 8 + bob); ctx.lineTo(sx - 8, sy - 25 + bob); ctx.lineTo(sx - 3, sy - 10 + bob); ctx.lineTo(sx + 3, sy - 25 + bob); ctx.lineTo(sx + 10, sy - 9 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff9e8'; ctx.fillRect(sx - 10, sy - 2 + bob, 6, 7); ctx.fillRect(sx + 4, sy - 2 + bob, 6, 7);
      ctx.fillStyle = enemy.enraged ? '#ff443f' : '#34463d';
      if (enemy.enraged) { ctx.shadowColor = '#ff352f'; ctx.shadowBlur = 10; }
      ctx.fillRect(sx - 7, sy, 3, 4); ctx.fillRect(sx + 7, sy, 3, 4); ctx.shadowBlur = 0;
    }
    if (enemy.hitFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.6, enemy.hitFlash * 2)})`; ctx.beginPath(); ctx.arc(sx, sy + bob, 24, 0, Math.PI * 2); ctx.fill(); }
    if (enemy.role === 'boss') {
      const healthRatio = clamp(enemy.health / enemy.maxHealth, 0, 1);
      const healthTop = sy - 38 + bob;
      ctx.fillStyle = 'rgba(39,54,43,.72)'; ctx.fillRect(sx - 25, healthTop - 1, 50, 8);
      ctx.fillStyle = '#eadfd2'; ctx.fillRect(sx - 22, healthTop + 1, 44, 4);
      ctx.fillStyle = enemy.enraged ? '#f05e50' : healthRatio > .5 ? '#79aa69' : healthRatio > .25 ? '#e3b65b' : '#df786b';
      ctx.fillRect(sx - 22, healthTop + 1, 44 * healthRatio, 4);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let heart = 1; heart < enemy.maxHealth; heart++) ctx.fillRect(sx - 22 + 44 * heart / enemy.maxHealth - .5, healthTop + 1, 1, 4);
    }
    ctx.restore();
  }

  function finalBossLaserEyes(enemy) {
    const eyeOffset = 7 * (enemy.bossScale || 1);
    return [
      { x: enemy.x - eyeOffset, y: enemy.y },
      { x: enemy.x + eyeOffset, y: enemy.y }
    ];
  }
  function finalBossLaserHitsPlayer(enemy) {
    const range = 760, radius = 17;
    const dx = Math.cos(enemy.laserAngle), dy = Math.sin(enemy.laserAngle);
    return finalBossLaserEyes(enemy).some(eye => {
      const px = player.x - eye.x, py = player.y - eye.y;
      const along = px * dx + py * dy;
      const across = Math.abs(px * dy - py * dx);
      return along >= 0 && along <= range && across <= radius;
    });
  }
  function drawFinalBossLasers(ctx, time) {
    const boss = enemies.find(enemy => enemy.role === 'boss' && enemy.bossId === FINAL_BOSS_ID && enemy.enraged);
    if (!boss || (boss.laserCharge <= 0 && boss.laserActive <= 0)) return;
    const charging = boss.laserCharge > 0;
    const pulse = .75 + Math.sin(time * .035) * .2;
    const range = 760, dx = Math.cos(boss.laserAngle), dy = Math.sin(boss.laserAngle);
    ctx.save();
    ctx.lineCap = 'round';
    for (const eye of finalBossLaserEyes(boss)) {
      const sx = eye.x - cameraX + world.size / 2, sy = eye.y - cameraY + world.size / 2;
      const ex = sx + dx * range, ey = sy + dy * range;
      if (charging) {
        ctx.setLineDash([12, 9]);
        ctx.strokeStyle = `rgba(255,91,79,${.48 + pulse * .2})`; ctx.lineWidth = 3 + pulse;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      } else {
        ctx.setLineDash([]);
        ctx.shadowColor = '#ff392f'; ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(255,53,45,.42)'; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff0c4'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawChicken(ctx, chicken, time) {
    const sx = chicken.x - cameraX + world.size / 2;
    const sy = chicken.y - cameraY + world.size / 2;
    if (sx < -30 || sy < -30 || sx > gameWidth + 30 || sy > gameHeight + 30) return;
    const bob = Math.sin(time * .012 + chicken.phase) * (chicken.fleeTimer > 0 || chicken.angry ? 1.8 : .7);
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(chicken.face);
    ctx.fillStyle = 'rgba(45,74,55,.2)'; ctx.beginPath(); ctx.ellipse(0, 7, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (chicken.angry) {
      ctx.fillStyle = 'rgba(255,50,45,.2)'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = chicken.angry ? '#df5149' : '#fff8e5';
    ctx.beginPath(); ctx.ellipse(-1, 1, 10, 7, -.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = chicken.angry ? '#f07b68' : '#e8d8b4';
    ctx.beginPath(); ctx.ellipse(-2, 1, 5, 5, -.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = chicken.angry ? '#f07862' : '#fff8e5';
    ctx.beginPath(); ctx.arc(6, -3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e85e55'; ctx.fillRect(4, -10, 2, 4); ctx.fillRect(7, -9, 2, 3);
    ctx.fillStyle = '#efa84f'; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(15, -1); ctx.lineTo(10, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = chicken.angry ? '#fff7df' : '#35463d'; ctx.fillRect(7, -5, 2, 2);
    ctx.fillStyle = '#d58a48'; ctx.fillRect(-4, 7, 2, 4); ctx.fillRect(2, 7, 2, 4);
    ctx.restore();
  }

  function launchConfetti() {
    confettiParticles.length = 0;
    const colors = ['#f47880', '#ffd568', '#73c8a0', '#79b9e8', '#ac8de0', '#fff2ae'];
    for (let i = 0; i < 180; i++) {
      const angle = -Math.PI / 2 + (Math.random() - .5) * 2.15;
      const speed = 150 + Math.random() * 390;
      confettiParticles.push({
        x: gameWidth / 2 + (Math.random() - .5) * 48, y: gameHeight * .68,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
        size: 4 + Math.random() * 5, rotation: Math.random() * Math.PI,
        spin: (Math.random() - .5) * 11, life: 3.6 + Math.random() * 1.6,
        color: colors[i % colors.length]
      });
    }
  }
  function updateConfetti(dt) {
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const piece = confettiParticles[i];
      piece.life -= dt; piece.x += piece.vx * dt; piece.y += piece.vy * dt;
      piece.vy += 520 * dt; piece.vx *= .995; piece.rotation += piece.spin * dt;
      if (piece.life <= 0 || piece.y > gameHeight + 20) confettiParticles.splice(i, 1);
    }
  }
  function drawConfetti(ctx) {
    if (!confettiParticles.length) return;
    ctx.save();
    for (const piece of confettiParticles) {
      ctx.globalAlpha = Math.min(1, piece.life / .5);
      ctx.fillStyle = piece.color; ctx.translate(piece.x, piece.y); ctx.rotate(piece.rotation);
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * .7);
      ctx.rotate(-piece.rotation); ctx.translate(-piece.x, -piece.y);
    }
    ctx.restore();
  }

  function renderWorld(time) {
    if (!gameWidth || !gameHeight) return;
    const cinematicElapsed = finalCinematicTimer > 0 ? finalCinematicDuration - finalCinematicTimer : 0;
    const shake = finalCinematicTimer > 0 ? Math.min(3.5, cinematicElapsed * 1.4) : 0;
    cameraX = player.x - gameWidth / 2 + Math.sin(time * .061) * shake;
    cameraY = player.y - gameHeight / 2 + Math.cos(time * .053) * shake * .6;
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
    drawSoccerField(gameCtx, time);
    drawWaterSlide(gameCtx, time);
    drawDanceParty(gameCtx, time);
    for (const idol of idolData) drawIdol(gameCtx, idol, time);
    drawFinalIdol(gameCtx, time);
    for (const enemy of enemies) drawEnemy(gameCtx, enemy, time);
    drawFinalBossLasers(gameCtx, time);
    drawDolphin(gameCtx, time);
    drawShark(gameCtx, time);
    for (const chicken of chickens) drawChicken(gameCtx, chicken, time);
    drawHero(gameCtx, time);
    drawConfetti(gameCtx);
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
  function populateChickens() {
    const spots = [];
    const addCandidate = (tileX, tileY) => {
      const x = tileX * world.size, y = tileY * world.size;
      if (biomeAt(Math.floor(tileX), Math.floor(tileY)) === 'water' || collides(x, y)) return false;
      if (Math.hypot(x - player.x, y - player.y) < 110) return false;
      if (spots.some(spot => Math.hypot(x - spot.x, y - spot.y) < 48)) return false;
      spots.push({ x, y });
      return true;
    };
    const columns = 10, rows = 5;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      for (let attempt = 0; attempt < 32; attempt++) {
        const tileX = 4 + (col + hash(col + attempt * 13, row, 31)) * 10.4;
        const tileY = 4 + (row + hash(row + attempt * 7, col, 47)) * 14.2;
        if (addCandidate(tileX, tileY)) break;
      }
    }
    for (let attempt = 0; spots.length < 50 && attempt < 8000; attempt++) {
      const tileX = 4 + hash(attempt, 3, 73) * 104;
      const tileY = 4 + hash(attempt, 9, 89) * 72;
      addCandidate(tileX, tileY);
    }
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i];
      chickens.push({ ...spot, homeX: spot.x, homeY: spot.y, face: hash(i, 2, 97) * Math.PI * 2, phase: hash(i, 4, 101) * Math.PI * 2, fleeTimer: 0, fleeDX: 0, fleeDY: 0, angry: false });
    }
  }
  populateChickens();
  function chickenCanMove(x, y) {
    return x >= 16 && y >= 16 && x <= world.width * world.size - 16 && y <= world.height * world.size - 16
      && biomeAt(Math.floor(x / world.size), Math.floor(y / world.size)) !== 'water' && !collides(x, y);
  }
  function updateChickens(dt) {
    for (const chicken of chickens) {
      chicken.phase += dt * (chicken.angry ? 15 : 7);
      const dxToPlayer = player.x - chicken.x, dyToPlayer = player.y - chicken.y;
      const distance = Math.hypot(dxToPlayer, dyToPlayer) || 1;
      let dx = 0, dy = 0, speed = 0;
      if (chicken.angry) {
        if (distance < 23) {
          const survived = hurtPlayer();
          chicken.angry = false;
          chicken.fleeTimer = .8;
          chicken.fleeDX = -dxToPlayer / distance;
          chicken.fleeDY = -dyToPlayer / distance;
          if (!survived) return;
          showToast('The red chicken pecked you, then ran off!');
          continue;
        }
        dx = dxToPlayer / distance; dy = dyToPlayer / distance; speed = 132;
      } else {
        if (distance < 112) {
          chicken.fleeTimer = .65;
          chicken.fleeDX = -dxToPlayer / distance;
          chicken.fleeDY = -dyToPlayer / distance;
        }
        chicken.fleeTimer = Math.max(0, chicken.fleeTimer - dt);
        if (chicken.fleeTimer <= 0) continue;
        dx = chicken.fleeDX; dy = chicken.fleeDY; speed = 92;
      }
      const targetAngle = Math.atan2(dy, dx);
      const turns = chicken.angry ? [0, -.45, .45, -.9, .9, -1.4, 1.4] : [0, .55, -.55, 1.1, -1.1, 1.7, -1.7];
      let moved = false;
      for (const turn of turns) {
        const angle = targetAngle + turn;
        const nextX = chicken.x + Math.cos(angle) * speed * dt;
        const nextY = chicken.y + Math.sin(angle) * speed * dt;
        if (!chickenCanMove(nextX, nextY)) continue;
        chicken.x = nextX; chicken.y = nextY; chicken.face = angle; moved = true;
        break;
      }
      if (!moved) chicken.face = targetAngle;
    }
  }
  function bopChickens() {
    let tagged = 0;
    for (const chicken of chickens) {
      if (chicken.angry || Math.hypot(player.x - chicken.x, player.y - chicken.y) > 31) continue;
      chicken.angry = true;
      chicken.fleeTimer = 0;
      tagged++;
    }
    return tagged;
  }
  function resetChickens() {
    for (const chicken of chickens) {
      chicken.x = chicken.homeX; chicken.y = chicken.homeY;
      chicken.fleeTimer = 0; chicken.fleeDX = 0; chicken.fleeDY = 0; chicken.angry = false;
    }
  }
  function updateEnemyCount() {
    if (!activeBossId) {
      $('#enemyCount').textContent = finalBossDefeated ? 'You won! The island is safe.' : defeatedBosses.size === idolData.length ? 'A giant idol waits at the island center' : defeatedBosses.size ? `${defeatedBosses.size}/5 guardians befriended` : 'Find a glowing idol';
      return;
    }
    const minions = enemies.filter(enemy => enemy.role === 'minion').length;
    $('#enemyCount').textContent = activeBossId === FINAL_BOSS_ID
      ? `${minions} guardian minion${minions === 1 ? '' : 's'} left · dash to bop`
      : `${minions} minion${minions === 1 ? '' : 's'} left · dash to bop`;
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
    const finalFight = activeBossId === FINAL_BOSS_ID;
    const idol = finalFight ? finalBossData : idolData.find(item => item.biome === activeBossId);
    const boss = enemies.find(enemy => enemy.role === 'boss');
    if (!idol) { hud.hidden = true; return; }
    hud.hidden = false;
    $('#bossEmoji').textContent = idol.glyph;
    $('#bossBiome').textContent = finalFight ? 'FINAL CHALLENGE · ISLAND CENTER' : `${biomeData[idol.biome].title} · ${idol.bossTitle}`;
    $('#bossName').textContent = boss ? `${idol.boss}${boss.enraged ? ' · ENRAGED' : ''}` : `${idol.boss} is nearly a friend`;
    if (finalFight && boss?.enraged) $('#bossBiome').textContent = 'ENRAGED · FINAL CHALLENGE';
    if (boss) {
      $('#bossHealthBar').style.width = `${Math.max(0, boss.health / boss.maxHealth * 100)}%`;
      $('#bossHealthLabel').textContent = `${boss.health} ${boss.health === 1 ? 'heart' : 'hearts'}`;
      $('#bossHealthBar').setAttribute('aria-valuenow', boss.health);
      $('#bossHealthBar').setAttribute('aria-valuemax', boss.maxHealth);
    } else {
      $('#bossHealthBar').style.width = '0%';
      $('#bossHealthLabel').textContent = finalFight ? 'Island guardian nearly defeated' : 'Guardian nearly befriended';
      $('#bossHealthBar').setAttribute('aria-valuenow', '0');
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
  function startFinalBossFight() {
    if (activeBossId || defeatedBosses.size !== idolData.length || finalBossDefeated) return;
    activeBossId = FINAL_BOSS_ID;
    enemies.length = 0;
    for (let i = 0; i < idolData.length; i++) {
      const guardian = idolData[i];
      const position = spawnPosition(i, idolData.length, 112 + i % 2 * 20);
      enemies.push({ ...position, role: 'minion', guardianForm: true, bossId: guardian.biome, bossType: guardian.bossType, bossScale: .58, palette: guardian.palette, color: i, phase: Math.random() * 6, speed: 38 });
    }
    const bossPosition = spawnPosition(idolData.length, idolData.length + 1, 205);
    enemies.push({ ...bossPosition, role: 'boss', bossId: FINAL_BOSS_ID, bossType: finalBossData.bossType, bossScale: 2.65, introProgress: 0, palette: finalBossData.palette, phase: Math.random() * 6, speed: 19, health: 12, maxHealth: 12, hitFlash: 0, enraged: false, laserCharge: 0, laserActive: 0, laserCooldown: 0 });
    nearbyIdolId = ''; pressed.clear();
    player.dashTimer = 0; player.dashCooldown = 0; player.dashHitBoss = false; player.moving = false;
    finalCinematicTimer = finalCinematicDuration; finalCinematicPhase = -1;
    $('#finalCinematic').hidden = false;
    updateBossHud(); updateEnemyCount();
    updateDashButton();
    updateFinalCinematic(0);
    showToast('The island trembles as the ancient guardian awakens!');
  }
  function updateFinalCinematic(dt) {
    if (finalCinematicTimer <= 0) return;
    finalCinematicTimer = Math.max(0, finalCinematicTimer - dt);
    const elapsed = finalCinematicDuration - finalCinematicTimer;
    const boss = enemies.find(enemy => enemy.role === 'boss');
    if (boss) boss.introProgress = clamp(elapsed / 3.25, 0, 1);
    const phase = elapsed < 1.65 ? 0 : elapsed < 3.35 ? 1 : 2;
    if (phase !== finalCinematicPhase) {
      finalCinematicPhase = phase;
      const scenes = [
        ['THE ISLAND REMEMBERS', 'The guardians return', 'Your new friends gather at the island’s heart.'],
        ['AN ANCIENT POWER AWAKENS', 'The Island Titan', 'A colossal guardian rises as the five guardians surround you.'],
        ['FINAL CHALLENGE', 'The Island Titan', 'Dash to strike. Defeat the titan to save the island.']
      ];
      const [eyebrow, title, caption] = scenes[phase];
      $('#cinematicEyebrow').textContent = eyebrow;
      $('#cinematicTitle').textContent = title;
      $('#cinematicCaption').textContent = caption;
      const copy = $('#finalCinematicCopy');
      copy.classList.remove('reveal'); void copy.offsetWidth; copy.classList.add('reveal');
    }
    pressed.clear();
    if (finalCinematicTimer === 0) {
      $('#finalCinematic').hidden = true;
      finalCinematicPhase = -1;
      showToast('The battle begins! Dash to strike the Island Titan.');
      updateDashButton();
    }
  }
  function checkIdolPickup() {
    if (activeBossId) return;
    if (defeatedBosses.size === idolData.length && !finalBossDefeated) {
      const distance = Math.hypot(player.x - finalBossData.tx * world.size, player.y - finalBossData.ty * world.size);
      if (distance < 24) { startFinalBossFight(); return; }
      if (distance < 68) {
        if (nearbyIdolId !== FINAL_BOSS_ID) showToast('The giant idol hums in the island center. Walk up to awaken it!');
        nearbyIdolId = FINAL_BOSS_ID;
        return;
      }
      nearbyIdolId = '';
      return;
    }
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
    if (defeatedBosses.size === idolData.length) showToast('All five guardians are your friends! A giant idol appeared at the island center!');
    else showToast(`${idol.boss} is your friend now! You found the ${idol.title}.`);
  }
  function finishFinalBossFight() {
    finalBossDefeated = true;
    activeBossId = null; nearbyIdolId = ''; enemies.length = 0;
    const existing = safeLoad();
    safeSave({ ...existing, finalBossDefeated: true });
    updateIdolProgress(); updateBossHud(); updateEnemyCount();
    $('#victoryBanner').hidden = false;
    launchConfetti();
    showToast('You won! The Island Titan is defeated!');
  }
  $('#continueButton').addEventListener('click', () => {
    $('#victoryBanner').hidden = true;
    showToast('The island is safe! Keep exploring with your guardian friends.');
  });
  function startDash() {
    if (!$('#playView').classList.contains('active') || finalCinematicTimer > 0 || player.ridingSlide || player.panicTimer > 0 || player.dolphinRideTimer > 0 || player.dashCooldown > 0 || player.dashTimer > 0) return;
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
    button.disabled = player.ridingSlide || player.panicTimer > 0 || player.dolphinRideTimer > 0 || cooling;
    button.classList.toggle('dashing', player.dashTimer > 0);
    button.classList.toggle('panic-run', player.panicTimer > 0);
    button.textContent = player.panicTimer > 0 ? '❗ Run!' : player.ridingSlide ? '💦 Whee!' : player.dolphinRideTimer > 0 ? '🐬 Riding' : player.dashTimer > 0 ? '⚡ Go!' : cooling ? '⚡ …' : '⚡ Dash';
    button.title = player.panicTimer > 0 ? 'Run to shore!' : player.ridingSlide || player.dolphinRideTimer > 0 ? 'Enjoy the ride!' : cooling ? 'Dash is recharging' : 'Dash in the direction you are facing';
  }
  function updateFinalBossAttack(enemy, dt) {
    if (enemy.role !== 'boss' || enemy.bossId !== FINAL_BOSS_ID) return true;
    if (!enemy.enraged && enemy.health <= enemy.maxHealth / 2) {
      enemy.enraged = true;
      enemy.speed = 46;
      enemy.laserCooldown = .7;
      updateBossHud();
      showToast('The Island Titan is enraged! Watch for eye lasers!');
    }
    if (!enemy.enraged) return true;
    if (enemy.laserActive > 0) {
      if (finalBossLaserHitsPlayer(enemy) && !hurtPlayer()) return false;
      enemy.laserActive = Math.max(0, enemy.laserActive - dt);
      return true;
    }
    if (enemy.laserCharge > 0) {
      enemy.laserCharge = Math.max(0, enemy.laserCharge - dt);
      if (enemy.laserCharge === 0) {
        enemy.laserActive = .32;
        enemy.laserCooldown = 2.25;
        showToast('The titan fires its eye lasers!');
      }
      return true;
    }
    enemy.laserCooldown = Math.max(0, enemy.laserCooldown - dt);
    if (enemy.laserCooldown === 0) {
      enemy.laserAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.laserCharge = .85;
      showToast('The titan is charging its eye lasers! Keep moving!');
    }
    return true;
  }
  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.phase += dt;
      enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - dt);
      if (!updateFinalBossAttack(enemy, dt)) return;
      if (enemy.knockbackTimer > 0) {
        const amount = Math.min(enemy.knockbackSpeed * dt, enemy.knockbackSpeed * enemy.knockbackTimer);
        const nextX = enemy.x + enemy.knockbackDX * amount, nextY = enemy.y + enemy.knockbackDY * amount;
        if (!collides(nextX, enemy.y)) enemy.x = clamp(nextX, 24, world.width * world.size - 24);
        if (!collides(enemy.x, nextY)) enemy.y = clamp(nextY, 24, world.height * world.size - 24);
        enemy.knockbackTimer = Math.max(0, enemy.knockbackTimer - dt);
        enemy.knockbackAngle *= .88;
        if (enemy.knockedOut && enemy.knockbackTimer === 0) enemies.splice(i, 1);
        continue;
      }
      if (enemy.staggerTimer > 0) { enemy.staggerTimer = Math.max(0, enemy.staggerTimer - dt); continue; }
      const dx = player.x - enemy.x, dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const contactRange = enemy.role === 'boss' ? 30 * Math.min(enemy.bossScale || 1, 2) : 30;
      if (distance < contactRange) {
        if (!hurtPlayer()) return;
        continue;
      }
      const step = Math.min(enemy.speed * dt, distance - 19);
      const nextX = enemy.x + dx / distance * step, nextY = enemy.y + dy / distance * step;
      if (!collides(nextX, enemy.y)) enemy.x = nextX;
      if (!collides(enemy.x, nextY)) enemy.y = nextY;
    }
    if (enemies.length === 0 && activeBossId) {
      if (activeBossId === FINAL_BOSS_ID) finishFinalBossFight();
      else finishBossFight();
    }
  }
  function setEnemyKnockback(enemy, dx, dy, speed, duration, angle, knockedOut = false) {
    const distance = Math.hypot(dx, dy) || 1;
    enemy.knockbackDX = distance > 1 ? dx / distance : -player.dashDX;
    enemy.knockbackDY = distance > 1 ? dy / distance : -player.dashDY;
    enemy.knockbackSpeed = speed;
    enemy.knockbackTimer = duration;
    enemy.knockbackAngle = (dx * player.dashDY - dy * player.dashDX >= 0 ? 1 : -1) * angle;
    enemy.knockedOut = knockedOut;
  }
  function bopEnemies() {
    let bopped = 0, bossHits = 0, finalBossKilled = false;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.knockbackTimer > 0) continue;
      const dx = player.x - enemy.x, dy = player.y - enemy.y;
      const reach = enemy.role === 'boss' ? 39 * Math.min(enemy.bossScale || 1, 2) : 29;
      if (dx * dx + dy * dy >= reach * reach) continue;
      if (enemy.role === 'boss') {
        if (player.dashHitBoss) continue;
        player.dashHitBoss = true;
        enemy.health--; enemy.hitFlash = .28; enemy.staggerTimer = .12;
        setEnemyKnockback(enemy, -dx, -dy, 240, .24, .22);
        bossHits++;
        if (enemy.health <= 0) {
          enemies.splice(i, 1);
          if (activeBossId === FINAL_BOSS_ID) finalBossKilled = true;
        }
      } else {
        setEnemyKnockback(enemy, -dx, -dy, 300, .38, .75, true);
        bopped++;
      }
    }
    const chickensTagged = bopChickens();
    if (!bopped && !bossHits && !chickensTagged) return;
    updateBossHud(); updateEnemyCount();
    if (finalBossKilled) { finishFinalBossFight(); return; }
    if (activeBossId && enemies.length === 0) {
      if (activeBossId === FINAL_BOSS_ID) finishFinalBossFight();
      else finishBossFight();
    }
    else if (bossHits) {
      const bossName = activeBossId === FINAL_BOSS_ID ? finalBossData.boss : idolData.find(item => item.biome === activeBossId)?.boss;
      showToast(`Dash! ${bossName} has ${enemies.find(enemy => enemy.role === 'boss')?.health ?? 0} hearts left.`);
    }
    else if (bopped) showToast(bopped === 1 ? 'Boop! One minion ran off.' : `Boop! ${bopped} minions ran off.`);
    else showToast(chickensTagged === 1 ? 'Cluck! That chicken is furious!' : `Cluck! ${chickensTagged} chickens are furious!`);
  }
  function updatePartyDance() {
    const tx = Math.floor(player.x / world.size), ty = Math.floor(player.y / world.size);
    const dancing = isDancePartyTile(tx, ty) && !player.inWater && !player.ridingSlide && player.dolphinRideTimer <= 0 && player.panicTimer <= 0 && player.dashTimer <= 0;
    if (dancing === player.partyDancing) return;
    player.partyDancing = dancing;
    if (dancing) {
      partyNoteTimer = 0;
      showToast('Dance party! Groove to the beat!');
    }
  }
  function waterSlidePointAt(distance) {
    let remaining = distance;
    for (let i = 0; i < waterSlide.points.length - 1; i++) {
      const from = waterSlide.points[i], to = waterSlide.points[i + 1];
      const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
      if (remaining <= length || i === waterSlide.points.length - 2) {
        const amount = Math.min(1, remaining / length);
        return { x: from.x + dx * amount, y: from.y + dy * amount, dx: dx / length, dy: dy / length };
      }
      remaining -= length;
    }
    return { ...waterSlide.points.at(-1), dx: 0, dy: 1 };
  }
  function startWaterSlide() {
    if (player.ridingSlide || player.panicTimer > 0 || player.dolphinRideTimer > 0) return false;
    const start = waterSlide.points[0];
    if (Math.hypot(player.x - start.x, player.y - start.y) > 23) return false;
    player.ridingSlide = true; player.slideProgress = 0; player.slideTimer = 0;
    player.x = start.x; player.y = start.y; player.face = 'down'; player.moving = true;
    played = true; $('#gameHint').classList.add('gone');
    showToast('Hop on and wheee!');
    return true;
  }
  function rideWaterSlide(dt) {
    const totalLength = waterSlide.points.slice(1).reduce((sum, point, index) => {
      const previous = waterSlide.points[index];
      return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
    }, 0);
    player.slideProgress = Math.min(totalLength, player.slideProgress + 300 * dt);
    const point = waterSlidePointAt(player.slideProgress);
    player.x = point.x; player.y = point.y; player.moving = true;
    if (Math.abs(point.dx) > Math.abs(point.dy)) player.face = point.dx > 0 ? 'right' : 'left';
    else player.face = point.dy > 0 ? 'down' : 'up';
    frameTime += dt * 1000;
    const nowInWater = biomeAt(Math.floor(player.x / world.size), Math.floor(player.y / world.size)) === 'water';
    if (nowInWater !== player.inWater) player.inWater = nowInWater;
    updateBiome(biomeAt(Math.floor(player.x / world.size), Math.floor(player.y / world.size)));
    if (player.slideProgress >= totalLength) {
      player.ridingSlide = false; player.inWater = true; player.slideTimer = .42;
      player.slideDX = point.dx; player.slideDY = point.dy;
      showToast('Splash landing! Keep exploring the pond.');
    }
    updateDashButton();
  }
  function movePlayer(dt) {
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.damageCooldown = Math.max(0, player.damageCooldown - dt);
    updatePlayerHealthRegeneration(dt);
    player.panicTimer = Math.max(0, player.panicTimer - dt);
    if (player.ridingSlide) { rideWaterSlide(dt); return; }
    if (player.dolphinRideTimer > 0) {
      player.dolphinRideTimer = Math.max(0, player.dolphinRideTimer - dt);
      if (player.dolphinRideTimer === 0) showToast('Dolphin ride finished. Find it on the east shore for another ride!');
    }
    updatePartyDance();
    const panicking = player.panicTimer > 0;
    const dashing = !panicking && player.dashTimer > 0;
    let dx = 0, dy = 0;
    if (panicking) { dx = player.panicDX; dy = player.panicDY; }
    else {
      if (pressed.has('ArrowLeft') || pressed.has('KeyA')) dx -= 1;
      if (pressed.has('ArrowRight') || pressed.has('KeyD')) dx += 1;
      if (pressed.has('ArrowUp') || pressed.has('KeyW')) dy -= 1;
      if (pressed.has('ArrowDown') || pressed.has('KeyS')) dy += 1;
    }
    const hasInput = !!(dx || dy);
    if (dashing) { dx = player.dashDX; dy = player.dashDY; }
    else if (!hasInput && player.inWater && player.slideTimer > 0) { dx = player.slideDX; dy = player.slideDY; }
    player.moving = !!(dx || dy);
    if (!player.moving) { updateDashButton(); return; }
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    const tx = dx * norm, ty = dy * norm;
    if (Math.abs(dx) > Math.abs(dy)) player.face = dx > 0 ? 'right' : 'left';
    else if (dy) player.face = dy > 0 ? 'down' : 'up';
    const speed = panicking ? 240 : dashing ? 365 : player.dolphinRideTimer > 0 ? 330 : player.slideTimer > 0 ? 175 : player.inWater ? 90 : 115;
    const amount = speed * dt;
    const nextX = player.x + tx * amount, nextY = player.y + ty * amount;
    if (!collides(nextX, player.y)) player.x = clamp(nextX, 15, world.width * world.size - 15);
    if (!collides(player.x, nextY)) player.y = clamp(nextY, 15, world.height * world.size - 15);
    updatePartyDance();
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
    if (panicking && !nextWater) {
      player.panicTimer = 0; player.sharkScareCooldown = 1.5; pressed.clear();
      showToast('You made it safely to shore!');
    }
    if (!dashing && player.panicTimer <= 0 && player.dolphinRideTimer <= 0 && startWaterSlide()) { updateDashButton(); return; }
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
      if (finalCinematicTimer <= 0) {
        movePlayer(dt);
        if (finalCinematicTimer <= 0) {
          updateShark(dt, time);
          updateSoccerBall(dt);
          updateSoccerHud();
          updateDolphinHud();
          updateEnemies(dt);
          updateChickens(dt);
        }
      }
      if (finalCinematicTimer > 0) updateFinalCinematic(dt);
      updateConfetti(dt);
      renderWorld(time);
      updatePartyMusic(time);
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
    if ($('#playView').classList.contains('active') && key === 'KeyF') {
      event.preventDefault(); if (!event.repeat) kickSoccerBall(); return;
    }
    if ($('#playView').classList.contains('active') && key === 'KeyE') {
      event.preventDefault(); if (!event.repeat) startDolphinRide(); return;
    }
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
  function resetGame(message = 'Back in the sunny meadow.') {
    if (activeBossId) awakenedIdols.delete(activeBossId);
    finalCinematicTimer = 0; finalCinematicPhase = -1; $('#finalCinematic').hidden = true;
    activeBossId = null;
    nearbyIdolId = '';
    player.x = 56 * 32; player.y = 40 * 32; player.face = 'down'; player.moving = false; player.inWater = false;
    player.health = maxPlayerHealth; player.damageCooldown = 0; player.healthRegenTimer = 0;
    player.slideTimer = 0; player.ridingSlide = false; player.slideProgress = 0; player.dolphinRideTimer = 0; player.sharkScareCooldown = 0; player.panicTimer = 0; player.partyDancing = false; player.dashTimer = 0; player.dashCooldown = 0; player.dashHitBoss = false; enemies.length = 0;
    resetChickens();
    shark.chasing = false; shark.x = shark.homeX; shark.y = shark.homeY;
    soccerBall.x = (soccerField.left + soccerField.right + 1) * world.size / 2; soccerBall.y = (soccerField.top + soccerField.bottom + 1) * world.size / 2;
    soccerBall.vx = 0; soccerBall.vy = 0; soccerBall.resetTimer = 0; soccerGoals = 0; soccerFieldWasActive = false;
    $('#soccerKickButton').hidden = true;
    lastBiome = ''; updateBiome('meadow'); pressed.clear();
    updatePlayerHealth(); updateIdolProgress(); updateBossHud(); updateEnemyCount(); updateDashButton(); updateDolphinHud();
    showToast(message);
  }
  $('#restartButton').addEventListener('click', () => resetGame());
  function restartEverything() {
    defeatedBosses.clear();
    awakenedIdols.clear();
    finalBossDefeated = false;
    found.clear(); found.add('meadow');
    $$('.discovery-item').forEach(item => item.classList.toggle('found', item.dataset.biome === 'meadow'));
    $('#discoveryCount').innerHTML = '1 <small>/ 5</small>';
    $('#discoveryProgress').style.width = '20%';
    $('#victoryBanner').hidden = true;
    confettiParticles.length = 0;
    const existing = safeLoad();
    safeSave({ ...existing, defeatedBosses: [], finalBossDefeated: false });
    resetGame('A fresh adventure begins in the sunny meadow!');
  }
  $('#restartEverythingButton').addEventListener('click', restartEverything);
  $('#dashButton').addEventListener('click', startDash);
  $('#soccerKickButton').addEventListener('click', kickSoccerBall);
  $('#dolphinRideButton').addEventListener('click', startDolphinRide);

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
  function updatePartyMusic(time) {
    if (!player.partyDancing || !soundOn || time < partyNoteTimer) return;
    const melody = [523, 659, 784, 659, 587, 698, 880, 698];
    playNote(melody[partyNoteIndex++ % melody.length], .18, .027);
    partyNoteTimer = time + 240;
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
  updatePlayerHealth(); updateIdolProgress(); updateBossHud(); updateEnemyCount(); updateDashButton();
  requestAnimationFrame(loop);
})();
