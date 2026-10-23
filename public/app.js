// Whisk AI — Frontend Client Application

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const previewContainer = document.getElementById("preview-container");
  const previewImg = document.getElementById("preview-img");
  const previewDimensions = document.getElementById("preview-dimensions");
  const previewFilesize = document.getElementById("preview-filesize");
  const btnRemoveImage = document.getElementById("btn-remove-image");

  const btnGenerate = document.getElementById("btn-generate");
  const btnText = btnGenerate.querySelector(".btn-text");
  const spinner = btnGenerate.querySelector(".spinner");
  const loadingBox = document.getElementById("loading-box");
  const loadingStatusText = document.getElementById("loading-status-text");

  const resultsSection = document.getElementById("results-section");
  const masterPromptText = document.getElementById("master-prompt-text");
  const promptCharCount = document.getElementById("prompt-char-count");
  const btnCopyMaster = document.getElementById("btn-copy-master");
  const aspectRatioVal = document.getElementById("aspect-ratio-val");
  const negativePromptVal = document.getElementById("negative-prompt-val");
  const btnCopyNegative = document.getElementById("btn-copy-negative");
  const paletteWrapper = document.getElementById("palette-wrapper");
  const paletteSwatches = document.getElementById("palette-swatches");

  // Breakdown fields
  const breakdownSubject = document.getElementById("breakdown-subject");
  const breakdownScene = document.getElementById("breakdown-scene");
  const breakdownStyle = document.getElementById("breakdown-style");
  const breakdownLighting = document.getElementById("breakdown-lighting");
  const breakdownColor = document.getElementById("breakdown-color");
  const breakdownCamera = document.getElementById("breakdown-camera");

  // Status & Key Modal
  const apiStatusBadge = document.getElementById("api-status-badge");
  const apiStatusText = document.getElementById("api-status-text");
  const btnApiKey = document.getElementById("btn-api-key");
  const apiModal = document.getElementById("api-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const inputApiKey = document.getElementById("input-api-key");
  const btnSaveKey = document.getElementById("btn-save-key");
  const btnClearKey = document.getElementById("btn-clear-key");
  const toast = document.getElementById("toast");

  // State
  let currentImageBase64 = null;
  let selectedEngine = "imagen3";
  let serverHasKey = false;
  let loadingInterval = null;

  const LOADING_MESSAGES = [
    "Scanning visual layers...",
    "Deconstructing subject identity & micro-textures...",
    "Analyzing spatial staging & background depth...",
    "Identifying artistic medium & render technique...",
    "Extracting lighting angles & color palette...",
    "Synthesizing high-fidelity master prompt..."
  ];

  // 1. Check API Key Status on Startup
  async function checkApiStatus() {
    try {
      let res = await fetch("/status");
      if (!res.ok) {
        res = await fetch("/api/status");
      }
      if (res.ok) {
        const data = await res.json();
        serverHasKey = data.has_server_api_key;
      }
    } catch (e) {
      console.warn("Could not reach status endpoint", e);
    }

    const localKey = localStorage.getItem("whisk_gemini_key");
    if (serverHasKey) {
      apiStatusBadge.className = "status-pill ready";
      apiStatusText.textContent = "API Ready (Server)";
    } else if (localKey) {
      apiStatusBadge.className = "status-pill ready";
      apiStatusText.textContent = "API Ready (Custom Key)";
      inputApiKey.value = localKey;
    } else {
      apiStatusBadge.className = "status-pill missing";
      apiStatusText.textContent = "Set API Key";
    }
  }
  checkApiStatus();

  // 2. Target Generator Presets
  document.querySelectorAll(".preset-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".preset-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedEngine = pill.dataset.engine;
    });
  });

  // 3. Dropzone & File Handling
  dropzone.addEventListener("click", (e) => {
    if (e.target.closest("#btn-remove-image")) return;
    if (!currentImageBase64) fileInput.click();
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Support Clipboard Paste (Ctrl+V) from anywhere on the page
  window.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        const blob = item.getAsFile();
        handleFile(blob);
        showToast("Image pasted from clipboard!");
        break;
      }
    }
  });

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPG, WEBP, GIF).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageBase64 = e.target.result;
      previewImg.src = currentImageBase64;

      previewImg.onload = () => {
        previewDimensions.textContent = `${previewImg.naturalWidth} × ${previewImg.naturalHeight}`;
        const sizeKb = (file.size / 1024).toFixed(1);
        previewFilesize.textContent = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        dropzone.querySelector(".dropzone-content").classList.add("hidden");
        previewContainer.classList.remove("hidden");
        btnGenerate.disabled = false;
      };
    };
    reader.readAsDataURL(file);
  }

  btnRemoveImage.addEventListener("click", (e) => {
    e.stopPropagation();
    currentImageBase64 = null;
    fileInput.value = "";
    previewImg.src = "";
    previewContainer.classList.add("hidden");
    dropzone.querySelector(".dropzone-content").classList.remove("hidden");
    btnGenerate.disabled = true;
    resultsSection.classList.add("hidden");
  });

  // 4. Prompt Generation
  btnGenerate.addEventListener("click", async () => {
    if (!currentImageBase64) return;

    let apiKey = localStorage.getItem("whisk_gemini_key") || (inputApiKey ? inputApiKey.value.trim() : null) || null;
    if (apiKey) apiKey = apiKey.trim();
    if (!serverHasKey && !apiKey) {
      openApiModal();
      return;
    }

    // Start loading state
    setLoading(true);

    try {
      const payload = {
        image: currentImageBase64,
        api_key: apiKey,
        target_engine: selectedEngine,
        detail_level: "whisk_deep"
      };

      let response = await fetch("/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.status === 404) {
        response = await fetch("/api/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || `Server returned ${response.status}`);
      }

      const result = await response.json();
      renderResults(result);
    } catch (err) {
      alert("Error generating prompt: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    btnGenerate.disabled = isLoading;
    if (isLoading) {
      btnText.classList.add("hidden");
      spinner.classList.remove("hidden");
      loadingBox.classList.remove("hidden");

      let msgIndex = 0;
      loadingStatusText.textContent = LOADING_MESSAGES[0];
      loadingInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
        loadingStatusText.textContent = LOADING_MESSAGES[msgIndex];
      }, 2000);
    } else {
      btnText.classList.remove("hidden");
      spinner.classList.add("hidden");
      loadingBox.classList.add("hidden");
      if (loadingInterval) clearInterval(loadingInterval);
    }
  }

  function renderResults(data) {
    // Master prompt
    masterPromptText.value = data.master_prompt || "";
    updateCharCount();

    // Whisk 6 Layers
    const breakdown = data.breakdown || {};
    breakdownSubject.textContent = breakdown.subject || "Not detected";
    breakdownScene.textContent = breakdown.scene || "Not detected";
    breakdownStyle.textContent = breakdown.style || "Not detected";
    breakdownLighting.textContent = breakdown.lighting || "Not detected";
    breakdownColor.textContent = breakdown.color || "Not detected";
    breakdownCamera.textContent = breakdown.camera || "Not detected";

    // Meta: Aspect ratio & negative
    aspectRatioVal.textContent = data.aspect_ratio || "1:1";
    negativePromptVal.textContent = data.negative_prompt || "blurry, low quality, distorted, extra limbs";

    // Palette Swatches
    paletteSwatches.innerHTML = "";
    if (data.palette_colors && data.palette_colors.length > 0) {
      paletteWrapper.classList.remove("hidden");
      data.palette_colors.forEach(hex => {
        const swatch = document.createElement("div");
        swatch.className = "color-swatch";
        swatch.style.backgroundColor = hex;
        swatch.title = `Click to copy: ${hex}`;
        swatch.addEventListener("click", () => {
          navigator.clipboard.writeText(hex);
          showToast(`Copied ${hex}!`);
        });
        paletteSwatches.appendChild(swatch);
      });
    } else {
      paletteWrapper.classList.add("hidden");
    }

    // Reveal results and scroll smoothly
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateCharCount() {
    const len = masterPromptText.value.length;
    const words = masterPromptText.value.trim() ? masterPromptText.value.trim().split(/\s+/).length : 0;
    promptCharCount.textContent = `${len} characters (${words} words)`;
  }
  masterPromptText.addEventListener("input", updateCharCount);

  // 5. Copy Actions
  btnCopyMaster.addEventListener("click", () => {
    navigator.clipboard.writeText(masterPromptText.value);
    showToast("Master prompt copied to clipboard!");
  });

  btnCopyNegative.addEventListener("click", () => {
    navigator.clipboard.writeText(negativePromptVal.textContent);
    showToast("Negative prompt copied!");
  });

  document.querySelectorAll(".btn-card-copy").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const targetElem = document.getElementById(targetId);
      if (targetElem && targetElem.textContent) {
        navigator.clipboard.writeText(targetElem.textContent);
        showToast("Layer description copied!");
      }
    });
  });

  // 6. Toast Notification
  let toastTimeout = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, 2400);
  }

  // 7. API Modal Handlers
  function openApiModal() {
    apiModal.classList.remove("hidden");
    inputApiKey.focus();
  }
  function closeApiModal() {
    apiModal.classList.add("hidden");
  }

  btnApiKey.addEventListener("click", openApiModal);
  btnCloseModal.addEventListener("click", closeApiModal);
  inputApiKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnSaveKey.click();
    }
  });
  apiModal.addEventListener("click", (e) => {
    if (e.target === apiModal) closeApiModal();
  });

  btnSaveKey.addEventListener("click", () => {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem("whisk_gemini_key", key);
      showToast("API Key saved in browser!");
    }
    checkApiStatus();
    closeApiModal();
  });

  btnClearKey.addEventListener("click", () => {
    localStorage.removeItem("whisk_gemini_key");
    inputApiKey.value = "";
    showToast("Saved API key cleared");
    checkApiStatus();
    closeApiModal();
  });
});
