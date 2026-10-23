(() => {
  "use strict";

  const scenes = [...document.querySelectorAll(".story-scene")];
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const resetButton = document.getElementById("resetButton");
  const interactionHint = document.getElementById("interactionHint");
  const bookStage = document.getElementById("bookStage");
  const buildBay = document.querySelector(".build-bay");
  const rocketWalkScene = document.getElementById("rocketWalkScene");
  const drawRocketButton = document.getElementById("drawRocketButton");
  const drawOverlay = document.getElementById("drawOverlay");
  const closeDrawButton = document.getElementById("closeDrawButton");
  const clearDrawingButton = document.getElementById("clearDrawingButton");
  const nextDrawStepButton = document.getElementById("nextDrawStepButton");
  const drawCanvas = document.getElementById("rocketCanvas");
  const drawContext = drawCanvas.getContext("2d");
  const fillToolButton = document.getElementById("fillToolButton");
  const drawColorInput = document.getElementById("drawColorInput");
  const drawPreview = document.getElementById("drawPreview");
  const editDrawingButton = document.getElementById("editDrawingButton");
  const rocketPreviewCanvas = document.getElementById("rocketPreviewCanvas");
  const rocketPreviewContext = rocketPreviewCanvas.getContext("2d");
  const packingItems = [...document.querySelectorAll(".pack-item")];
  const packTapeButton = document.getElementById("packTape");
  const packBox = document.getElementById("packBox");
  const packLoadedItems = document.getElementById("packLoadedItems");
  const packingNext = document.getElementById("packingNext");
  const totalPages = scenes.length - 1;

  let currentPage = 0;
  let foundParts = new Set();
  let placedParts = new Set();
  let selectedPart = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let explorerPosition = { x: 50, y: 69 };
  let walkingTimer = null;
  let launchTimer = null;
  let packedItems = new Set();
  let packingCompleted = false;
  let draggingPackItem = null;
  let packPointerStart = null;
  let packPointerMoved = false;
  let isDrawing = false;
  let lastDrawPoint = null;
  let strokeCount = 0;
  let currentDrawStep = 0;
  let activeStroke = null;
  let drawingCompleted = false;
  let fillMode = false;
  const drawnStrokes = [];
  const drawnFills = [];
  const drawingColors = ["#ff6da9", "#6b4df6", "#68b9ff", "#6ae0be", "#ff9b58", "#ffd54a"];
  const drawingSteps = [
    { title: "Draw the rocket body", instruction: "Start with one tall, rounded body in the middle." },
    { title: "Draw the nose cone", instruction: "Add a pointy nose on top of the body." },
    { title: "Draw the window", instruction: "Put a round window in the middle." },
    { title: "Draw two stabilizer fins", instruction: "Add one fin on each side of the body." },
    { title: "Draw the engine flame", instruction: "Finish the bottom with a big, wiggly flame." },
    { title: "Add your own details", instruction: "Decorate your rocket with stars, stripes, or a name." }
  ];

  const pageNames = ["Cover", "The big idea", "Dig, dig, dig!", "Make it fly", "Three... two... one!", "Mars discoveries"];
  const progressStorageKey = "johnny-builds-to-mars-progress-v1";

  function persistProgress() {
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify({
        currentPage,
        packedItems: [...packedItems],
        packingCompleted,
        foundParts: [...foundParts],
        placedParts: [...placedParts],
        discoveredItems: [...discoveredItems],
        explorerPosition,
        drawingCompleted,
        currentDrawStep,
        drawnStrokes,
        drawnFills,
        landed: spaceScene.classList.contains("landed")
      }));
    } catch (error) {
      // The story still works if the browser blocks local storage.
    }
  }

  function canAdvance() {
    if (currentPage === 1) return packingCompleted;
    if (currentPage === 2) return foundParts.size === 5;
    if (currentPage === 3) return placedParts.size === 6 || drawingCompleted;
    if (currentPage === 4) return spaceScene.classList.contains("landed");
    return currentPage < totalPages;
  }

  function updateReaderChrome() {
    const readablePage = currentPage === 0 ? "Start here" : `Page ${currentPage} of ${totalPages}`;
    progressFill.style.width = `${(currentPage / totalPages) * 100}%`;
    progressText.textContent = readablePage;
    prevButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === totalPages || !canAdvance();
    nextButton.innerHTML = currentPage === totalPages ? `The end <span aria-hidden="true">✦</span>` : `Next <span aria-hidden="true">→</span>`;
    interactionHint.innerHTML = currentPage === 0
      ? `<span aria-hidden="true">✦</span> Use ← →, swipe, or the buttons to turn the page`
      : `<span aria-hidden="true">✦</span> ${pageNames[currentPage]} · ${currentPage === 1 ? "pack the trip supplies" : currentPage === 2 ? "tap each X" : currentPage === 3 ? "drag or tap the parts" : currentPage === 5 ? "walk with arrows or WASD" : "keep reading"}`;
  }

  function showPage(page, direction = "forward") {
    const nextPage = Math.max(0, Math.min(totalPages, page));
    if (nextPage > currentPage && !canAdvance()) {
      pulseBlockedPage();
      return;
    }
    currentPage = nextPage;
    scenes.forEach((scene, index) => {
      const isActive = index === currentPage;
      scene.classList.toggle("active", isActive);
      scene.setAttribute("aria-hidden", String(!isActive));
      scene.style.setProperty("--page-direction", direction === "back" ? "-1" : "1");
    });
    updateReaderChrome();
    bookStage.focus({ preventScroll: true });
    persistProgress();
  }

  function pulseBlockedPage() {
    const scene = scenes[currentPage];
    scene.classList.remove("needs-attention");
    requestAnimationFrame(() => scene.classList.add("needs-attention"));
    if (currentPage === 2) {
      document.getElementById("digMessage").textContent = "There are still secret parts hiding in the grass.";
    }
    if (currentPage === 1) {
      document.getElementById("packingMessage").textContent = "Find every supply, then grab the tape to seal the pack.";
    }
    if (currentPage === 3) {
      document.getElementById("buildMessage").textContent = "The rocket still needs a few pieces.";
    }
    if (currentPage === 4) {
      document.getElementById("launchMessage").textContent = "Press launch to continue the mission.";
    }
    if (currentPage === 5) {
      document.getElementById("discoveryMessage").textContent = "There are still discoveries hiding on Mars.";
    }
  }

  function goNext() { if (currentPage < totalPages) showPage(currentPage + 1); }
  function goBack() { if (currentPage > 0) showPage(currentPage - 1, "back"); }

  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => showPage(Number(button.dataset.goto)));
  });
  prevButton.addEventListener("click", goBack);
  nextButton.addEventListener("click", goNext);

  document.addEventListener("keydown", (event) => {
    const movementKeys = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0],
      d: [1, 0]
    };
    const movement = movementKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (currentPage === 5 && movement) {
      event.preventDefault();
      moveExplorer(movement[0], movement[1]);
      return;
    }
    if (event.key === "ArrowRight") { event.preventDefault(); goNext(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); goBack(); }
  });

  bookStage.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  bookStage.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      deltaX < 0 ? goNext() : goBack();
    }
  }, { passive: true });

  function updatePackingUI() {
    const supplyCount = packedItems.size;
    const allSuppliesFound = supplyCount === 5;
    document.getElementById("packingCount").textContent = `${supplyCount} / 5`;
    document.getElementById("packingProgress").style.width = `${(supplyCount / 5) * 100}%`;
    packLoadedItems.replaceChildren();
    packedItems.forEach((packName) => {
      const sourceItem = packingItems.find((item) => item.dataset.pack === packName);
      if (!sourceItem) return;
      const loadedItem = document.createElement("span");
      loadedItem.className = `pack-loaded-item loaded-${packName}`;
      loadedItem.textContent = sourceItem.querySelector("span:last-child").textContent;
      packLoadedItems.append(loadedItem);
    });
    packingItems.forEach((item) => {
      const isTape = item.dataset.pack === "tape";
      item.classList.toggle("collected", !isTape && packedItems.has(item.dataset.pack));
      if (isTape) item.hidden = !allSuppliesFound || packingCompleted;
    });
    packTapeButton.disabled = !allSuppliesFound || packingCompleted;
    packBox.classList.toggle("sealed", packingCompleted);
    packingNext.disabled = !packingCompleted;
    document.getElementById("packingMessage").textContent = packingCompleted
      ? "Packed and taped! Johnny and Pixel are ready to go."
      : allSuppliesFound ? "Everything is packed! Grab the tape and seal it shut."
      : `${5 - supplyCount} ${5 - supplyCount === 1 ? "supply is" : "supplies are"} still waiting in the house.`;
    updateReaderChrome();
    persistProgress();
  }

  function collectPackingItem(packName) {
    if (packName === "tape") {
      if (packedItems.size === 5) {
        packingCompleted = true;
        updatePackingUI();
      }
      return;
    }
    if (packedItems.has(packName)) return;
    packedItems.add(packName);
    updatePackingUI();
  }

  function isOverPackBox(clientX, clientY) {
    const box = packBox.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  }

  function clearPackDrag() {
    if (draggingPackItem) {
      const finishedItem = draggingPackItem;
      finishedItem.classList.remove("dragging");
      window.setTimeout(() => { finishedItem.dataset.dragged = "false"; }, 0);
    }
    draggingPackItem = null;
    packPointerStart = null;
    packPointerMoved = false;
    packBox.classList.remove("drop-ready");
  }

  packingItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (item.dataset.pack === "tape") {
        document.getElementById("packingMessage").textContent = "Drag the tape onto the box to seal it.";
        return;
      }
      if (item.dataset.dragged === "true") {
        item.dataset.dragged = "false";
        return;
      }
      collectPackingItem(item.dataset.pack);
    });
    item.addEventListener("dragstart", (event) => {
      if (item.classList.contains("collected")) { event.preventDefault(); return; }
      draggingPackItem = item;
      item.dataset.dragged = "true";
      item.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.dataset.pack);
    });
    item.addEventListener("dragend", clearPackDrag);
    item.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || item.classList.contains("collected")) return;
      draggingPackItem = item;
      packPointerStart = { x: event.clientX, y: event.clientY };
      packPointerMoved = false;
      item.setPointerCapture?.(event.pointerId);
    });
    item.addEventListener("pointermove", (event) => {
      if (draggingPackItem !== item || !packPointerStart) return;
      const movedX = event.clientX - packPointerStart.x;
      const movedY = event.clientY - packPointerStart.y;
      if (Math.hypot(movedX, movedY) > 8) {
        packPointerMoved = true;
        item.dataset.dragged = "true";
        item.classList.add("dragging");
        packBox.classList.toggle("drop-ready", isOverPackBox(event.clientX, event.clientY));
      }
    });
    item.addEventListener("pointerup", (event) => {
      if (draggingPackItem !== item) return;
      const droppedInBox = packPointerMoved && isOverPackBox(event.clientX, event.clientY);
      if (packPointerMoved) item.dataset.dragged = "true";
      clearPackDrag();
      if (droppedInBox) collectPackingItem(item.dataset.pack);
    });
    item.addEventListener("pointercancel", clearPackDrag);
  });

  packBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    packBox.classList.add("drop-ready");
  });
  packBox.addEventListener("dragleave", () => packBox.classList.remove("drop-ready"));
  packBox.addEventListener("drop", (event) => {
    event.preventDefault();
    collectPackingItem(event.dataTransfer.getData("text/plain"));
    clearPackDrag();
  });

  function updateDigUI() {
    const count = foundParts.size;
    document.getElementById("partsCount").textContent = `${count} / 5`;
    document.getElementById("partsProgress").style.width = `${(count / 5) * 100}%`;
    const digNext = document.getElementById("digNext");
    digNext.disabled = count !== 5;
    document.getElementById("digMessage").textContent = count === 5
      ? "You found every piece! Time to build."
      : count === 0 ? "Which X should we try first?" : `${5 - count} secret ${5 - count === 1 ? "part is" : "parts are"} still hiding.`;
    updateReaderChrome();
    persistProgress();
  }

  document.querySelectorAll(".dig-spot").forEach((spot) => {
    spot.addEventListener("click", () => {
      const part = spot.dataset.part;
      if (foundParts.has(part)) return;
      foundParts.add(part);
      spot.classList.add("found");
      updateDigUI();
    });
  });

  function selectPart(partCard) {
    if (partCard.classList.contains("placed")) return;
    document.querySelectorAll(".part-card").forEach((part) => part.classList.remove("selected"));
    selectedPart = partCard.dataset.part;
    partCard.classList.add("selected");
    document.querySelectorAll(".slot:not(.filled)").forEach((slot) => slot.classList.add("slot-ready"));
    document.getElementById("buildMessage").textContent = `Now tap the glowing ${selectedPart} spot.`;
  }

  function clearPartSelection() {
    selectedPart = null;
    document.querySelectorAll(".part-card").forEach((part) => part.classList.remove("selected"));
    document.querySelectorAll(".slot").forEach((slot) => slot.classList.remove("slot-ready"));
  }

  function visualPartName(partName) {
    return partName.startsWith("fin-") ? "fin" : partName;
  }

  function placePart(partName, slot) {
    if (!partName || !slot || slot.dataset.part !== partName || placedParts.has(partName)) return;
    placedParts.add(partName);
    slot.classList.add("filled");
    const slotArt = slot.querySelector("span");
    slotArt.className = `slot-art part-art part-${visualPartName(partName)}`;
    slotArt.textContent = "";
    const partCard = document.querySelector(`.part-card[data-part="${partName}"]`);
    if (partCard) partCard.classList.add("placed");
    clearPartSelection();
    updateBuildUI();
  }

  function updateBuildUI() {
    const count = placedParts.size;
    const rocketComplete = count === 6;
    document.getElementById("buildCount").textContent = `${count} / 6`;
    document.getElementById("buildProgress").style.width = `${(count / 6) * 100}%`;
    document.getElementById("buildMessage").textContent = rocketComplete
      ? "Rocket complete! Johnny and Pixel are walking inside."
      : drawingCompleted ? "Your drawn rocket is ready! Continue to the launch pad."
      : count === 0 ? "The rocket is waiting for its first piece." : `${count} piece${count === 1 ? "" : "s"} locked in. Keep going!`;
    rocketWalkScene.hidden = !rocketComplete;
    buildBay.classList.toggle("rocket-ready", rocketComplete);
    document.getElementById("buildNext").disabled = !(rocketComplete || drawingCompleted);
    updateReaderChrome();
    persistProgress();
  }

  function drawRoundedGuide(x, y, width, height, radius) {
    drawContext.beginPath();
    drawContext.moveTo(x + radius, y);
    drawContext.lineTo(x + width - radius, y);
    drawContext.quadraticCurveTo(x + width, y, x + width, y + radius);
    drawContext.lineTo(x + width, y + height - radius);
    drawContext.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    drawContext.lineTo(x + radius, y + height);
    drawContext.quadraticCurveTo(x, y + height, x, y + height - radius);
    drawContext.lineTo(x, y + radius);
    drawContext.quadraticCurveTo(x, y, x + radius, y);
    drawContext.stroke();
  }

  function drawCurrentStepGuide() {
    drawContext.save();
    drawContext.setLineDash([11, 12]);
    drawContext.lineWidth = 5;
    drawContext.lineCap = "round";
    drawContext.lineJoin = "round";
    drawContext.strokeStyle = "rgba(107, 77, 246, 0.28)";
    if (currentDrawStep === 0) {
      drawRoundedGuide(292, 105, 136, 220, 48);
    } else if (currentDrawStep === 1) {
      drawContext.beginPath();
      drawContext.moveTo(360, 45); drawContext.lineTo(292, 110); drawContext.lineTo(428, 110); drawContext.closePath(); drawContext.stroke();
    } else if (currentDrawStep === 2) {
      drawContext.beginPath(); drawContext.arc(360, 180, 36, 0, Math.PI * 2); drawContext.stroke();
    } else if (currentDrawStep === 3) {
      drawContext.beginPath();
      drawContext.moveTo(294, 225); drawContext.lineTo(218, 276); drawContext.lineTo(292, 292); drawContext.closePath();
      drawContext.moveTo(426, 225); drawContext.lineTo(502, 276); drawContext.lineTo(428, 292); drawContext.closePath();
      drawContext.stroke();
    } else if (currentDrawStep === 4) {
      drawContext.beginPath();
      drawContext.moveTo(320, 322); drawContext.lineTo(342, 372); drawContext.lineTo(360, 347); drawContext.lineTo(378, 372); drawContext.lineTo(400, 322); drawContext.closePath(); drawContext.stroke();
    } else {
      drawContext.beginPath();
      drawContext.arc(235, 95, 10, 0, Math.PI * 2);
      drawContext.arc(485, 120, 10, 0, Math.PI * 2);
      drawContext.moveTo(255, 205); drawContext.lineTo(285, 205);
      drawContext.moveTo(435, 205); drawContext.lineTo(465, 205);
      drawContext.stroke();
    }
    drawContext.restore();
  }

  function drawStoredStrokeTo(context, stroke) {
    if (!stroke.points.length) return;
    context.fillStyle = stroke.color;
    context.strokeStyle = stroke.color;
    context.lineWidth = 10;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(stroke.points[0].x, stroke.points[0].y, 5, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }

  function drawStoredStroke(stroke) {
    drawStoredStrokeTo(drawContext, stroke);
  }

  function hexToRgba(hex) {
    const value = hex.replace("#", "");
    const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
      255
    ];
  }

  function samePixel(data, index, target, tolerance = 30) {
    return Math.abs(data[index] - target[0]) <= tolerance
      && Math.abs(data[index + 1] - target[1]) <= tolerance
      && Math.abs(data[index + 2] - target[2]) <= tolerance
      && Math.abs(data[index + 3] - target[3]) <= tolerance;
  }

  function fillContextAt(context, x, y, color) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const startX = Math.max(0, Math.min(width - 1, Math.floor(x)));
    const startY = Math.max(0, Math.min(height - 1, Math.floor(y)));
    const image = context.getImageData(0, 0, width, height);
    const data = image.data;
    const startIndex = (startY * width + startX) * 4;
    const target = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];
    const replacement = hexToRgba(color);
    if (samePixel(data, startIndex, replacement, 0)) return false;

    const stack = [startY * width + startX];
    let filledPixels = 0;
    while (stack.length) {
      const pixel = stack.pop();
      const pixelX = pixel % width;
      const pixelY = Math.floor(pixel / width);
      const index = pixel * 4;
      if (!samePixel(data, index, target)) continue;
      data[index] = replacement[0];
      data[index + 1] = replacement[1];
      data[index + 2] = replacement[2];
      data[index + 3] = replacement[3];
      filledPixels += 1;
      if (pixelX > 0) stack.push(pixel - 1);
      if (pixelX < width - 1) stack.push(pixel + 1);
      if (pixelY > 0) stack.push(pixel - width);
      if (pixelY < height - 1) stack.push(pixel + width);
    }

    if (!filledPixels) return false;
    context.putImageData(image, 0, 0);
    return true;
  }

  function renderCleanDrawing(context) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    drawnStrokes.forEach((stroke) => drawStoredStrokeTo(context, stroke));
    drawnFills.forEach((fill) => fillContextAt(context, fill.x, fill.y, fill.color));
    drawnStrokes.forEach((stroke) => drawStoredStrokeTo(context, stroke));
  }

  function drawRocketGuide() {
    drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawContext.fillStyle = "#fffdf8";
    drawContext.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawnStrokes.forEach(drawStoredStroke);
    drawnFills.forEach((fill) => fillContextAt(drawContext, fill.x, fill.y, fill.color));
    drawCurrentStepGuide();
    drawnStrokes.forEach(drawStoredStroke);
    if (activeStroke) drawStoredStroke(activeStroke);
  }

  function updateDrawStepUI() {
    const step = drawingSteps[currentDrawStep];
    document.getElementById("drawStepNumber").textContent = `Step ${currentDrawStep + 1} of ${drawingSteps.length}`;
    document.getElementById("drawStepTitle").textContent = step.title;
    document.getElementById("drawStepInstruction").textContent = step.instruction;
    nextDrawStepButton.innerHTML = currentDrawStep === drawingSteps.length - 1
      ? "Done drawing <span aria-hidden=\"true\">✓</span>"
      : "Next step <span aria-hidden=\"true\">→</span>";
  }

  function updateDrawStatus() {
    const fillText = drawnFills.length ? ` · ${drawnFills.length} ${drawnFills.length === 1 ? "fill" : "fills"}` : "";
    document.getElementById("drawStatus").textContent = `${strokeCount} ${strokeCount === 1 ? "stroke" : "strokes"}${fillText}`;
  }

  function updateDrawButton(saved) {
    drawRocketButton.innerHTML = saved
      ? "Edit my rocket <span aria-hidden=\"true\">✎</span>"
      : "Draw a rocket too <span aria-hidden=\"true\">✎</span>";
  }

  function saveDrawingPreview() {
    renderCleanDrawing(rocketPreviewContext);
    drawPreview.hidden = false;
    updateDrawButton(true);
  }

  function renderFlightDrawing() {
    const useCustomRocket = drawingCompleted && drawnStrokes.length > 0;
    rocketFlight.classList.toggle("custom-rocket", useCustomRocket);
    drawnFlightRocket.hidden = !useCustomRocket;
    if (!useCustomRocket) return;

    const points = drawnStrokes.flatMap((stroke) => stroke.points);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    renderCleanDrawing(rocketPreviewContext);
    const cropPadding = 32;
    const cropX = Math.max(0, minX - cropPadding);
    const cropY = Math.max(0, minY - cropPadding);
    const cropRight = Math.min(rocketPreviewCanvas.width, maxX + cropPadding);
    const cropBottom = Math.min(rocketPreviewCanvas.height, maxY + cropPadding);
    const sourceWidth = Math.max(1, cropRight - cropX);
    const sourceHeight = Math.max(1, cropBottom - cropY);
    const padding = 24;
    const scale = Math.min(
      (drawnFlightRocket.width - padding * 2) / sourceWidth,
      (drawnFlightRocket.height - padding * 2) / sourceHeight
    );
    const targetWidth = sourceWidth * scale;
    const targetHeight = sourceHeight * scale;
    const offsetX = (drawnFlightRocket.width - targetWidth) / 2;
    const offsetY = (drawnFlightRocket.height - targetHeight) / 2;
    const flightContext = drawnFlightRocket.getContext("2d");
    flightContext.clearRect(0, 0, drawnFlightRocket.width, drawnFlightRocket.height);
    flightContext.drawImage(
      rocketPreviewCanvas,
      cropX,
      cropY,
      sourceWidth,
      sourceHeight,
      offsetX,
      offsetY,
      targetWidth,
      targetHeight
    );
  }

  function clearDrawing() {
    const wasCompleted = drawingCompleted;
    isDrawing = false;
    lastDrawPoint = null;
    activeStroke = null;
    fillMode = false;
    drawnStrokes.length = 0;
    drawnFills.length = 0;
    strokeCount = 0;
    currentDrawStep = 0;
    drawingCompleted = false;
    drawPreview.hidden = true;
    updateDrawButton(false);
    updateDrawStepUI();
    drawRocketGuide();
    updateDrawStatus();
    updateFillMode();
    renderFlightDrawing();
    if (wasCompleted) updateBuildUI();
    persistProgress();
  }

  function setDrawingOpen(isOpen) {
    drawOverlay.hidden = !isOpen;
    drawRocketButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      drawPreview.hidden = true;
      updateDrawStepUI();
      drawRocketGuide();
      drawCanvas.focus({ preventScroll: true });
    }
  }

  function canvasPoint(event) {
    const bounds = drawCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (drawCanvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (drawCanvas.height / bounds.height)
    };
  }

  function startDrawing(event) {
    isDrawing = true;
    lastDrawPoint = canvasPoint(event);
    activeStroke = { color: drawingColors[strokeCount % drawingColors.length], points: [lastDrawPoint] };
    drawCanvas.setPointerCapture(event.pointerId);
    drawRocketGuide();
  }

  function updateFillMode() {
    fillToolButton.setAttribute("aria-pressed", String(fillMode));
    fillToolButton.textContent = fillMode ? "Bucket on ✓" : "Bucket fill";
    drawCanvas.classList.toggle("fill-mode", fillMode);
  }

  function fillCanvasAtPointer(event) {
    const point = canvasPoint(event);
    const color = drawColorInput.value;
    if (!fillContextAt(drawContext, point.x, point.y, color)) return;
    drawnFills.push({ x: point.x, y: point.y, color });
    drawRocketGuide();
    updateDrawStatus();
    persistProgress();
  }

  function handleCanvasPointerDown(event) {
    if (fillMode) {
      fillCanvasAtPointer(event);
      return;
    }
    startDrawing(event);
  }

  function continueDrawing(event) {
    if (!isDrawing || !activeStroke) return;
    const nextPoint = canvasPoint(event);
    activeStroke.points.push(nextPoint);
    lastDrawPoint = nextPoint;
    drawRocketGuide();
  }

  function stopDrawing() {
    if (!isDrawing || !activeStroke) return;
    isDrawing = false;
    lastDrawPoint = null;
    drawnStrokes.push(activeStroke);
    activeStroke = null;
    strokeCount = drawnStrokes.length;
    drawRocketGuide();
    updateDrawStatus();
    persistProgress();
  }

  drawRocketButton.addEventListener("click", () => setDrawingOpen(true));
  closeDrawButton.addEventListener("click", () => {
    saveDrawingPreview();
    setDrawingOpen(false);
  });
  editDrawingButton.addEventListener("click", () => setDrawingOpen(true));
  clearDrawingButton.addEventListener("click", clearDrawing);
  fillToolButton.addEventListener("click", () => {
    fillMode = !fillMode;
    updateFillMode();
  });
  nextDrawStepButton.addEventListener("click", () => {
    if (currentDrawStep === drawingSteps.length - 1) {
      saveDrawingPreview();
      drawingCompleted = true;
      renderFlightDrawing();
      updateBuildUI();
      setDrawingOpen(false);
      return;
    }
    currentDrawStep += 1;
    updateDrawStepUI();
    drawRocketGuide();
    persistProgress();
  });
  drawCanvas.addEventListener("pointerdown", handleCanvasPointerDown);
  drawCanvas.addEventListener("pointermove", continueDrawing);
  drawCanvas.addEventListener("pointerup", stopDrawing);
  drawCanvas.addEventListener("pointercancel", stopDrawing);
  drawCanvas.addEventListener("pointerleave", stopDrawing);

  document.querySelectorAll(".part-card").forEach((partCard) => {
    partCard.addEventListener("click", () => selectPart(partCard));
    partCard.addEventListener("dragstart", (event) => {
      if (partCard.classList.contains("placed")) { event.preventDefault(); return; }
      selectedPart = partCard.dataset.part;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", selectedPart);
      document.querySelectorAll(".slot:not(.filled)").forEach((slot) => slot.classList.add("slot-ready"));
    });
    partCard.addEventListener("dragend", clearPartSelection);
  });

  document.querySelectorAll(".slot").forEach((slot) => {
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!slot.classList.contains("filled")) slot.classList.add("slot-ready");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("slot-ready"));
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      placePart(event.dataTransfer.getData("text/plain") || selectedPart, slot);
    });
    slot.addEventListener("click", () => placePart(selectedPart, slot));
    slot.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); placePart(selectedPart, slot); }
    });
  });

  const launchButton = document.getElementById("launchButton");
  const launchButtonText = document.getElementById("launchButtonText");
  const launchMessage = document.getElementById("launchMessage");
  const spaceScene = document.getElementById("spaceScene");
  const rocketFlight = document.getElementById("rocketFlight");
  const drawnFlightRocket = document.getElementById("drawnFlightRocket");
  const marsMessage = document.getElementById("marsMessage");
  const discoveryObjects = [...document.querySelectorAll(".discovery-object")];
  const totalDiscoveries = 20;
  const marsExploreScene = document.getElementById("marsExploreScene");
  const explorerPeople = document.querySelector(".explorer-people");
  const discoveryBubble = document.getElementById("discoveryBubble");
  const endButton = document.getElementById("endButton");
  const endHint = document.getElementById("endHint");
  let discoveredItems = new Set();

  discoveryObjects.forEach((object) => {
    object.style.setProperty("--item-x", `${object.dataset.x}%`);
    object.style.setProperty("--item-y", `${object.dataset.y}%`);
  });

  function setExplorerPosition() {
    marsExploreScene.style.setProperty("--player-x", `${explorerPosition.x}%`);
    marsExploreScene.style.setProperty("--player-y", `${explorerPosition.y}%`);
  }

  function collectDiscovery(object) {
    const discovery = object.dataset.discovery;
    if (discoveredItems.has(discovery)) return;
    discoveredItems.add(discovery);
    object.classList.add("found");
    object.querySelector(".discovery-label").textContent = "found!";
    discoveryBubble.hidden = false;
    window.setTimeout(() => {
      if (currentPage === 5) discoveryBubble.hidden = true;
    }, 1000);
    updateDiscoveryUI();
  }

  function checkNearbyDiscoveries() {
    discoveryObjects.forEach((object) => {
      if (discoveredItems.has(object.dataset.discovery)) return;
      const distanceX = explorerPosition.x - Number(object.dataset.x);
      const distanceY = explorerPosition.y - Number(object.dataset.y);
      const distance = Math.sqrt((distanceX * distanceX) + (distanceY * distanceY));
      if (distance < 8.5) collectDiscovery(object);
    });
  }

  function moveExplorer(horizontal, vertical) {
    explorerPosition = {
      x: Math.max(8, Math.min(92, explorerPosition.x + horizontal * 4.5)),
      y: Math.max(18, Math.min(84, explorerPosition.y + vertical * 4.5))
    };
    setExplorerPosition();
    explorerPeople.classList.add("walking");
    window.clearTimeout(walkingTimer);
    walkingTimer = window.setTimeout(() => explorerPeople.classList.remove("walking"), 260);
    checkNearbyDiscoveries();
    persistProgress();
  }

  function updateDiscoveryUI() {
    const count = discoveredItems.size;
    const remaining = totalDiscoveries - count;
    document.getElementById("discoveryCount").textContent = `${count} / ${totalDiscoveries}`;
    document.getElementById("discoveryProgress").style.width = `${(count / totalDiscoveries) * 100}%`;
    document.getElementById("discoveryMessage").textContent = count === totalDiscoveries
      ? "You found all 20 surprises! Johnny and Pixel are expert explorers."
      : count === 0 ? "Use the arrow keys, WASD, or tap a direction to walk around Mars."
        : `${remaining} more ${remaining === 1 ? "discovery is" : "discoveries are"} waiting. Walk near the glowing things to find them.`;
    endButton.disabled = count !== totalDiscoveries;
    endHint.textContent = count === totalDiscoveries ? "Tap The End to read the adventure again." : "Find all 20 discoveries to finish the adventure.";
    updateReaderChrome();
    persistProgress();
  }

  discoveryObjects.forEach((object) => {
    object.addEventListener("click", () => collectDiscovery(object));
  });

  const moveVectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentPage !== 5) return;
      const movement = moveVectors[button.dataset.move];
      moveExplorer(movement[0], movement[1]);
      marsExploreScene.focus({ preventScroll: true });
    });
  });

  launchButton.addEventListener("click", () => {
    if (spaceScene.classList.contains("landed")) {
      showPage(5);
      return;
    }
    if (spaceScene.classList.contains("launching")) return;
    launchButton.disabled = true;
    launchButtonText.textContent = "Liftoff!";
    launchMessage.textContent = "WHOOSH! Johnny and Pixel are on their way to Mars.";
    spaceScene.classList.add("launching");
    persistProgress();
    launchTimer = window.setTimeout(() => {
      launchTimer = null;
      spaceScene.classList.add("landed");
      marsMessage.hidden = false;
      launchMessage.textContent = "They made it — Mars is ready to explore!";
      launchButtonText.textContent = "Mission complete";
      launchButton.disabled = false;
      updateReaderChrome();
      persistProgress();
    }, 1750);
  });

  function loadProgress() {
    let saved = null;
    try {
      const rawProgress = localStorage.getItem(progressStorageKey);
      saved = rawProgress ? JSON.parse(rawProgress) : null;
    } catch (error) {
      saved = null;
    }

    if (!saved || typeof saved !== "object") {
      clearDrawing();
      return;
    }

    currentPage = Number.isInteger(saved.currentPage) ? Math.max(0, Math.min(totalPages, saved.currentPage)) : 0;
    packedItems = new Set(Array.isArray(saved.packedItems) ? saved.packedItems : []);
    packingCompleted = saved.packingCompleted === true;
    foundParts = new Set(Array.isArray(saved.foundParts) ? saved.foundParts : []);
    placedParts = new Set(Array.isArray(saved.placedParts) ? saved.placedParts : []);
    discoveredItems = new Set(Array.isArray(saved.discoveredItems) ? saved.discoveredItems : []);
    drawingCompleted = saved.drawingCompleted === true;
    explorerPosition = {
      x: Number.isFinite(saved.explorerPosition?.x) ? Math.max(8, Math.min(92, saved.explorerPosition.x)) : 50,
      y: Number.isFinite(saved.explorerPosition?.y) ? Math.max(18, Math.min(84, saved.explorerPosition.y)) : 69
    };

    document.querySelectorAll(".dig-spot").forEach((spot) => {
      spot.classList.toggle("found", foundParts.has(spot.dataset.part));
    });
    document.querySelectorAll(".part-card").forEach((partCard) => {
      partCard.classList.toggle("placed", placedParts.has(partCard.dataset.part));
    });
    document.querySelectorAll(".slot").forEach((slot) => {
      const filled = placedParts.has(slot.dataset.part);
      slot.classList.toggle("filled", filled);
      const slotArt = slot.querySelector("span");
      slotArt.className = `slot-art part-art part-${visualPartName(slot.dataset.part)}`;
      slotArt.textContent = "";
    });
    discoveryObjects.forEach((object) => {
      const found = discoveredItems.has(object.dataset.discovery);
      object.classList.toggle("found", found);
      object.querySelector(".discovery-label").textContent = found ? "found!" : object.dataset.label;
    });

    const landed = saved.landed === true;
    spaceScene.classList.toggle("landed", landed);
    spaceScene.classList.remove("launching");
    marsMessage.hidden = !landed;
    launchButton.disabled = false;
    launchButtonText.textContent = landed ? "Mission complete" : "Launch the rocket";
    launchMessage.textContent = landed ? "They made it — Mars is ready to explore!" : "Engine check: ready when you are.";

    drawnStrokes.length = 0;
    if (Array.isArray(saved.drawnStrokes)) {
      saved.drawnStrokes.forEach((stroke) => {
        if (!stroke || typeof stroke.color !== "string" || !Array.isArray(stroke.points)) return;
        const points = stroke.points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
        if (points.length) drawnStrokes.push({ color: stroke.color, points });
      });
    }
    drawnFills.length = 0;
    if (Array.isArray(saved.drawnFills)) {
      saved.drawnFills.forEach((fill) => {
        if (!fill || !Number.isFinite(fill.x) || !Number.isFinite(fill.y) || typeof fill.color !== "string") return;
        drawnFills.push({ x: fill.x, y: fill.y, color: fill.color });
      });
    }
    strokeCount = drawnStrokes.length;
    currentDrawStep = Number.isInteger(saved.currentDrawStep) ? Math.max(0, Math.min(drawingSteps.length - 1, saved.currentDrawStep)) : 0;
    updateDrawStepUI();
    drawRocketGuide();
    updateDrawStatus();
    if (drawingCompleted) {
      saveDrawingPreview();
      renderFlightDrawing();
    } else {
      renderFlightDrawing();
    }
    if (!drawingCompleted) {
      drawPreview.hidden = true;
      updateDrawButton(false);
    }
    updatePackingUI();
    setExplorerPosition();
    showPage(currentPage, "back");
  }

  function resetStory() {
    window.clearTimeout(launchTimer);
    launchTimer = null;
    packedItems = new Set();
    packingCompleted = false;
    packingItems.forEach((item) => item.classList.remove("collected"));
    packTapeButton.hidden = true;
    packBox.classList.remove("sealed");
    foundParts = new Set();
    placedParts = new Set();
    selectedPart = null;
    discoveredItems = new Set();
    document.querySelectorAll(".dig-spot").forEach((spot) => spot.classList.remove("found"));
    document.querySelectorAll(".part-card").forEach((part) => part.classList.remove("placed", "selected"));
    document.querySelectorAll(".slot").forEach((slot) => {
      slot.classList.remove("filled", "slot-ready");
      const part = slot.dataset.part;
      const slotArt = slot.querySelector("span");
      slotArt.className = `slot-art part-art part-${visualPartName(part)}`;
      slotArt.textContent = "";
    });
    discoveryObjects.forEach((object) => {
      object.classList.remove("found");
      object.querySelector(".discovery-label").textContent = object.dataset.label;
    });
    explorerPosition = { x: 50, y: 69 };
    setExplorerPosition();
    explorerPeople.classList.remove("walking");
    window.clearTimeout(walkingTimer);
    discoveryBubble.hidden = true;
    rocketWalkScene.hidden = true;
    buildBay.classList.remove("rocket-ready");
    setDrawingOpen(false);
    clearDrawing();
    spaceScene.classList.remove("launching", "landed");
    marsMessage.hidden = true;
    launchButton.disabled = false;
    launchButtonText.textContent = "Launch the rocket";
    launchMessage.textContent = "Engine check: ready when you are.";
    endButton.disabled = true;
    updatePackingUI();
    updateDigUI();
    updateBuildUI();
    updateDiscoveryUI();
    showPage(0, "back");
  }

  endButton.addEventListener("click", resetStory);
  resetButton.addEventListener("click", resetStory);

  loadProgress();
  setExplorerPosition();
  updatePackingUI();
  updateDigUI();
  updateBuildUI();
  updateDiscoveryUI();
  updateReaderChrome();
})();
