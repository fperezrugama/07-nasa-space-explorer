
/* ============================================================
   PROJECT 7 — NASA SPACE EXPLORER APP
   File: js/script.js

   NASA APOD Basic API
   https://science.nasa.gov/wp-json/wp/v2/apod-basic

   Project features:
   1. Fetch NASA APOD entries using selected dates
   2. Display images, titles, dates, and explanations
   3. Open a detailed image/video modal
   4. Show loading and error messages
   5. Handle video entries (LevelUp — 10 points)
   6. Display random space facts (LevelUp — 10 points)
   7. Support hover zoom through CSS (LevelUp — 5 points)
   8. Search, favorites, and theme toggle

   IMPORTANT:
   Do not modify the instructor's js/dateRange.js.
   ============================================================ */


// ============================================================
// STEP 1 — GET OUR HTML ELEMENTS
// ============================================================

const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const fetchButton = document.getElementById("fetchButton");

const gallery = document.getElementById("gallery");
const statusMessage = document.getElementById("statusMessage");
const selectedRange = document.getElementById("selectedRange");
const resultsSummary = document.getElementById("resultsSummary");

const searchInput = document.getElementById("searchInput");
const favoritesToggle = document.getElementById("favoritesToggle");
const themeToggle = document.getElementById("themeToggle");

const spaceFact = document.getElementById("spaceFact");
const newFactButton = document.getElementById("newFactButton");

const modal = document.getElementById("modal");
const appContainer = document.querySelector(".container");
const closeModalButton = document.getElementById("closeModal");
const modalMedia = document.getElementById("modalMedia");
const modalDate = document.getElementById("modalDate");
const modalTitle = document.getElementById("modalTitle");
const modalExplanation = document.getElementById("modalExplanation");
const modalLink = document.getElementById("modalLink");

// Instructor-provided date setup.
setupDateInputs(startInput, endInput);


// ============================================================
// STEP 2 — NASA API AND APP VARIABLES
// ============================================================

// Updated NASA APOD Basic endpoint.
// No API key is required for this endpoint.
const API_URL =
  "https://science.nasa.gov/wp-json/wp/v2/apod-basic";

// NASA documents a maximum of 25 entries per page.
const MAX_DAYS = 25;

// Store the current NASA results.
let spaceImages = [];

// Favorites filter state.
let showingFavoritesOnly = false;

// Store favorite dates in the browser.
let favorites = [];

try {
  const saved = JSON.parse(
    localStorage.getItem("nasaFavorites") || "[]"
  );

  favorites = Array.isArray(saved) ? saved : [];
} catch (error) {
  console.warn("Could not read saved favorites:", error);
}

// Cache successful requests during the current page session.
const requestCache = new Map();

// Prevent overlapping requests.
let activeRequest = false;

// Remember the focused element when opening the modal.
let lastFocusedElement = null;


// ============================================================
// STEP 3 — RANDOM SPACE FACTS
// LEVELUP: 10 POINTS
// ============================================================

const spaceFacts = [
  "Jupiter's Great Red Spot is a storm that has lasted for at least 150 years.",
  "The Milky Way galaxy is approximately 100,000 light-years across.",
  "Light travels through space at about 300,000 kilometers per second.",
  "Saturn's rings are made mostly of ice particles and rocky material.",
  "A day on Venus is longer than a year on Venus.",
  "Mars has the tallest known volcano in the Solar System: Olympus Mons.",
  "A black hole has gravity so strong that light cannot escape its event horizon.",
  "Some neutron stars rotate hundreds of times every second.",
  "Footprints left on the Moon could remain for millions of years.",
  "More than 1,300 Earths could fit inside Jupiter by volume.",
  "Sunlight takes approximately eight minutes to reach Earth.",
  "Saturn has a lower average density than water.",
  "The Sun contains more than 99 percent of the Solar System's total mass.",
  "The Moon moves away from Earth by approximately 3.8 centimeters each year.",
  "One year on Neptune lasts about 165 Earth years."
];

// Display a randomly selected fact.
function showRandomFact() {
  const currentFact = spaceFact.textContent;

  const availableFacts = spaceFacts.filter(
    fact => fact !== currentFact
  );

  const randomIndex = Math.floor(
    Math.random() * availableFacts.length
  );

  spaceFact.textContent = availableFacts[randomIndex];
}


// ============================================================
// STEP 4 — HELPER FUNCTIONS
// ============================================================

// Format YYYY-MM-DD as a readable date.
function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// Shorten explanations for gallery cards.
function shortenText(text, maxLength = 150) {
  if (!text) return "No explanation available.";

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trim()}…`;
}

// Check whether a YYYY-MM-DD date is valid.
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Convert YYYY-MM-DD into NASA's YYMMDD format.
//
// Example:
// 2026-10-14 -> 261014
function toApodDate(dateString) {
  return dateString.slice(2).replaceAll("-", "");
}

// Calculate the number of days in a range.
function countDays(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  return Math.round((end - start) / 86400000) + 1;
}

// Validate the selected dates.
function readDateRange() {
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate || !endDate) {
    throw new Error("Please select both dates.");
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new Error("Please select valid dates.");
  }

  if (startDate < earliestDate || endDate > today) {
    throw new Error(
      "Choose dates between June 16, 1995 and today."
    );
  }

  if (startDate > endDate) {
    throw new Error(
      "The start date cannot be after the end date."
    );
  }

  if (countDays(startDate, endDate) > MAX_DAYS) {
    throw new Error(
      `Please select no more than ${MAX_DAYS} days at a time.`
    );
  }

  return { startDate, endDate };
}

// Convert HTML-formatted API text into plain text.
function htmlToText(value) {
  const container = document.createElement("div");

  container.innerHTML = String(value || "");

  return (container.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

// Only accept HTTPS URLs.
function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url.href : null;
  } catch (error) {
    return null;
  }
}

// Show a message above the gallery.
function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}


// ============================================================
// STEP 5 — FETCH DATA FROM NASA
// ============================================================

async function fetchSpaceImages(startDate, endDate) {
  const url = new URL(API_URL);

  // Updated API parameters from NASA's official guide.
  url.search = new URLSearchParams({
    date_from: toApodDate(startDate),
    date_to: toApodDate(endDate),
    per_page: String(MAX_DAYS)
  }).toString();

  console.log("Requesting NASA APOD:", url.href);

  // STEP A: Fetch the data.
  const response = await fetch(url.href);

  // STEP B: Check the response.
  if (!response.ok) {
    let message = `NASA API error: HTTP ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData.message) {
        message = htmlToText(errorData.message);
      }
    } catch (error) {
      // Keep the original HTTP error.
    }

    throw new Error(message);
  }

  // STEP C: Convert the response into JSON.
  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "NASA returned an unexpected response format."
    );
  }

  // STEP D: Normalize the returned entries.
  const entries = data
    .filter(item => (
      item &&
      isValidDate(item.date) &&
      item.date >= startDate &&
      item.date <= endDate &&
      typeof item.title === "string"
    ))
    .map(item => ({
      date: item.date,
      title: htmlToText(item.title),
      explanation: htmlToText(item.explanation),
      media_type: String(item.media_type || "image").toLowerCase(),

      // In the updated API, hdurl is the image URL.
      hdurl: safeUrl(item.hdurl),

      // The url field points to the NASA article.
      url: safeUrl(item.url),

      // Link to the original NASA APOD page.
      permalink: safeUrl(item.permalink) || safeUrl(item.url),

      thumbnail_url: safeUrl(item.thumbnail_url),
      alt: htmlToText(item.alt || item.title)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Useful information for debugging.
  console.table(
    entries.map(item => ({
      date: item.date,
      title: item.title,
      media_type: item.media_type,
      image_url: item.hdurl
    }))
  );

  return entries;
}


// ============================================================
// STEP 6 — CREATE GALLERY HELPER ELEMENTS
// ============================================================

// Display a placeholder when media is unavailable.
function createUnavailableMedia(message) {
  const placeholder = document.createElement("div");

  placeholder.className = "unavailable-media";
  placeholder.textContent = message;

  return placeholder;
}

// Create a video preview.
function createVideoPreview(item) {
  const preview = document.createElement("div");
  preview.className = "video-preview";

  const thumbnailUrl = item.thumbnail_url || item.hdurl;

  if (thumbnailUrl) {
    const thumbnail = document.createElement("img");

    thumbnail.className = "video-thumbnail";
    thumbnail.src = thumbnailUrl;
    thumbnail.alt = item.alt || item.title;
    thumbnail.loading = "lazy";

    thumbnail.addEventListener("error", () => {
      thumbnail.remove();
    });

    preview.append(thumbnail);
  }

  const playIcon = document.createElement("span");
  playIcon.textContent = "▶";

  const label = document.createElement("p");
  label.textContent = "Watch Video";

  preview.append(playIcon, label);

  return preview;
}

// Display an empty-state message.
function showEmptyState(symbol, message) {
  gallery.replaceChildren();

  const placeholder = document.createElement("div");
  placeholder.className = "placeholder";

  const icon = document.createElement("div");
  icon.className = "placeholder-icon";
  icon.textContent = symbol;

  const text = document.createElement("p");
  text.textContent = message;

  placeholder.append(icon, text);
  gallery.append(placeholder);
}


// ============================================================
// STEP 7 — DISPLAY THE NASA GALLERY
// ============================================================

function renderGallery() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  const visibleImages = spaceImages.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm) ||
      item.explanation.toLowerCase().includes(searchTerm);

    const matchesFavorites =
      !showingFavoritesOnly || favorites.includes(item.date);

    return matchesSearch && matchesFavorites;
  });

  resultsSummary.textContent =
    `${visibleImages.length} ${
      visibleImages.length === 1 ? "discovery" : "discoveries"
    } found`;

  if (!visibleImages.length) {
    showEmptyState(
      "✦",
      "No discoveries match your filters yet."
    );

    return;
  }

  gallery.replaceChildren();

  visibleImages.forEach(item => {
    const card = document.createElement("article");

    card.className =
      item.media_type === "image"
        ? "gallery-item"
        : "gallery-item video-card";

    card.dataset.date = item.date;
    card.tabIndex = 0;

    // --------------------------------------------
    // MEDIA CONTAINER
    // --------------------------------------------

    const mediaContainer = document.createElement("div");
    mediaContainer.className = "card-media";

    if (item.media_type === "image") {
      if (item.hdurl) {
        const image = document.createElement("img");

        image.src = item.hdurl;
        image.alt = item.alt || item.title;
        image.loading = "lazy";

        image.addEventListener("error", () => {
          console.warn(
            "Image failed to load:",
            item.hdurl
          );

          image.replaceWith(
            createUnavailableMedia("Image unavailable")
          );
        });

        mediaContainer.append(image);
      } else {
        mediaContainer.append(
          createUnavailableMedia("Image unavailable")
        );
      }
    } else {
      // Video or iframe APOD entry.
      mediaContainer.append(createVideoPreview(item));
    }

    // --------------------------------------------
    // FAVORITE BUTTON
    // --------------------------------------------

    const isFavorite = favorites.includes(item.date);

    const favoriteButton = document.createElement("button");

    favoriteButton.type = "button";
    favoriteButton.className =
      `favorite-button ${isFavorite ? "is-favorite" : ""}`;

    favoriteButton.dataset.favorite = item.date;

    favoriteButton.setAttribute(
      "aria-label",
      isFavorite ? "Remove from favorites" : "Add to favorites"
    );

    favoriteButton.textContent = isFavorite ? "♥" : "♡";

    mediaContainer.append(favoriteButton);

    // --------------------------------------------
    // CARD CONTENT
    // --------------------------------------------

    const content = document.createElement("div");
    content.className = "card-content";

    const date = document.createElement("p");
    date.className = "card-date";
    date.textContent = formatDate(item.date);

    const title = document.createElement("h2");
    title.textContent = item.title;

    const explanation = document.createElement("p");
    explanation.className = "card-explanation";

    explanation.textContent = shortenText(
      item.explanation
    );

    const readMore = document.createElement("button");

    readMore.type = "button";
    readMore.className = "read-more";
    readMore.dataset.open = item.date;

    readMore.textContent =
      item.media_type === "image"
        ? "Read story ↗"
        : "Watch Video ↗";

    content.append(
      date,
      title,
      explanation,
      readMore
    );

    card.append(mediaContainer, content);

    gallery.append(card);
  });
}


// ============================================================
// STEP 8 — LOADING AND ERROR MESSAGES
// ============================================================

function showLoadingState() {
  gallery.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "loading-state";

  const spinner = document.createElement("div");
  spinner.className = "loader";

  const message = document.createElement("p");
  message.textContent = "Loading space photos…";

  wrapper.append(spinner, message);
  gallery.append(wrapper);
}

function showErrorState(message) {
  showEmptyState("📡", message);

  const retryButton = document.createElement("button");

  retryButton.className = "retry-button";
  retryButton.type = "button";
  retryButton.textContent = "Retry request";

  retryButton.addEventListener(
    "click",
    getSpaceImages
  );

  gallery.querySelector(".placeholder").append(retryButton);
}


// ============================================================
// STEP 9 — GET SPACE IMAGES BUTTON
// ============================================================

async function getSpaceImages() {
  if (activeRequest) return;

  let dateRange;

  try {
    dateRange = readDateRange();
  } catch (error) {
    showStatus(error.message, "error");
    return;
  }

  const { startDate, endDate } = dateRange;

  const cacheKey = `${startDate}:${endDate}`;

  activeRequest = true;

  fetchButton.disabled = true;

  fetchButton.innerHTML =
    'Scanning the skies <span class="spinner"></span>';

  showStatus("Loading space photos…");
  showLoadingState();

  try {
    // Use cached data when available.
    if (requestCache.has(cacheKey)) {
      spaceImages = requestCache.get(cacheKey);
    } else {
      spaceImages = await fetchSpaceImages(startDate, endDate);

      requestCache.set(cacheKey, spaceImages);
    }

    selectedRange.textContent =
      `${formatDate(startDate)} — ${formatDate(endDate)}`;

    if (spaceImages.length > 0) {
      renderGallery();

      showStatus(
        `Archive loaded · ${formatDate(startDate)} — ${formatDate(endDate)}`,
        "success"
      );
    } else {
      showEmptyState(
        "✦",
        "NASA returned no APOD entries for these dates."
      );

      showStatus(
        "No APOD entries found for this range.",
        "error"
      );
    }
  } catch (error) {
    console.error("NASA APOD error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load NASA data.";

    showStatus(message, "error");
    showErrorState(message);
  } finally {
    activeRequest = false;

    fetchButton.disabled = false;

    fetchButton.innerHTML =
      "Get Space Images <span>↗</span>";
  }
}


// ============================================================
// STEP 10 — FAVORITES
// ============================================================

function toggleFavorite(date) {
  if (favorites.includes(date)) {
    favorites = favorites.filter(item => item !== date);
  } else {
    favorites.push(date);
  }

  try {
    localStorage.setItem(
      "nasaFavorites",
      JSON.stringify(favorites)
    );
  } catch (error) {
    console.warn("Could not save favorites:", error);
  }

  renderGallery();
}


// ============================================================
// STEP 11 — VIDEO SUPPORT
// LEVELUP: 10 POINTS
// ============================================================

// Convert supported video URLs into embed URLs.
function getVideoEmbedUrl(value) {
  const href = safeUrl(value);

  if (!href) return null;

  const url = new URL(href);

  // YouTube short links.
  if (url.hostname === "youtu.be") {
    const videoId = url.pathname.slice(1);

    return /^[\w-]{11}$/.test(videoId)
      ? `https://www.youtube.com/embed/${videoId}`
      : null;
  }

  // YouTube standard links.
  if (
    url.hostname === "youtube.com" ||
    url.hostname === "www.youtube.com"
  ) {
    const videoId =
      url.searchParams.get("v") ||
      (
        url.pathname.startsWith("/embed/")
          ? url.pathname.split("/")[2]
          : ""
      );

    return /^[\w-]{11}$/.test(videoId || "")
      ? `https://www.youtube.com/embed/${videoId}`
      : null;
  }

  // Vimeo links.
  if (
    url.hostname === "vimeo.com" ||
    url.hostname === "www.vimeo.com"
  ) {
    const videoId = url.pathname
      .split("/")
      .filter(Boolean)[0];

    return /^\d+$/.test(videoId || "")
      ? `https://player.vimeo.com/video/${videoId}`
      : null;
  }

  // Existing Vimeo embed links.
  if (
    url.hostname === "player.vimeo.com" &&
    /^\/video\/\d+/.test(url.pathname)
  ) {
    return href;
  }

  return null;
}


// ============================================================
// STEP 12 — IMAGE / VIDEO MODAL
// ============================================================

function openModal(item) {
  if (!item) return;

  lastFocusedElement = document.activeElement;

  modalMedia.replaceChildren();

  // --------------------------------------------
  // IMAGE
  // --------------------------------------------

  if (item.media_type === "image") {
    if (item.hdurl) {
      const image = document.createElement("img");

      image.src = item.hdurl;
      image.alt = item.alt || item.title;

      image.addEventListener("error", () => {
        modalMedia.replaceChildren(
          createUnavailableMedia("Image unavailable")
        );
      });

      modalMedia.append(image);
    } else {
      modalMedia.append(
        createUnavailableMedia("Image unavailable")
      );
    }
  } else {
    // --------------------------------------------
    // VIDEO OR IFRAME
    // --------------------------------------------

    // The new API's url is generally an article URL,
    // not a directly embeddable video.
    //
    // We use a clear link to the NASA article
    // when a direct video embed is unavailable.

    const embedUrl = getVideoEmbedUrl(
      item.thumbnail_url
    );

    if (embedUrl) {
      const iframe = document.createElement("iframe");

      iframe.src = embedUrl;
      iframe.title = item.title;
      iframe.allowFullscreen = true;

      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      );

      modalMedia.append(iframe);
    } else {
      modalMedia.append(
        createUnavailableMedia(
          "This APOD contains a video. Use the link below to watch it on NASA's website."
        )
      );
    }
  }

  // --------------------------------------------
  // MODAL DETAILS
  // --------------------------------------------

  modalDate.textContent = formatDate(item.date);
  modalTitle.textContent = item.title;

  modalExplanation.textContent =
    item.explanation || "No explanation available.";

  modalLink.href =
    item.permalink || "https://science.nasa.gov/apod/";

  modalLink.textContent =
    item.media_type === "image"
      ? "View original on NASA.gov ↗"
      : "Watch video on NASA.gov ↗";

  modalLink.target = "_blank";
  modalLink.rel = "noopener noreferrer";

  modal.hidden = false;

  if (appContainer) {
    appContainer.inert = true;
  }

  document.body.classList.add("modal-open");

  closeModalButton.focus();
}


// Close the modal.
function closeModal() {
  modal.hidden = true;

  if (appContainer) {
    appContainer.inert = false;
  }

  document.body.classList.remove("modal-open");

  if (
    lastFocusedElement &&
    lastFocusedElement.isConnected
  ) {
    lastFocusedElement.focus();
  }
}


// ============================================================
// STEP 13 — CONNECT ALL EVENT LISTENERS
// ============================================================

function initializeApp() {
  // Random fact on page load.
  showRandomFact();

  // Get NASA images.
  fetchButton.addEventListener(
    "click",
    getSpaceImages
  );

  // New random fact button.
  newFactButton.addEventListener(
    "click",
    showRandomFact
  );

  // Search gallery.
  searchInput.addEventListener(
    "input",
    renderGallery
  );

  // Favorites filter.
  favoritesToggle.addEventListener("click", () => {
    showingFavoritesOnly = !showingFavoritesOnly;

    favoritesToggle.classList.toggle(
      "active",
      showingFavoritesOnly
    );

    favoritesToggle.setAttribute(
      "aria-pressed",
      String(showingFavoritesOnly)
    );

    renderGallery();
  });

  // --------------------------------------------
  // GALLERY CLICK EVENTS
  // --------------------------------------------

  gallery.addEventListener("click", event => {
    const favoriteButton =
      event.target.closest("[data-favorite]");

    const openButton =
      event.target.closest("[data-open]");

    const card =
      event.target.closest(".gallery-item");

    if (favoriteButton) {
      event.stopPropagation();

      toggleFavorite(
        favoriteButton.dataset.favorite
      );
    } else if (openButton || card) {
      const date = openButton
        ? openButton.dataset.open
        : card.dataset.date;

      const item = spaceImages.find(
        entry => entry.date === date
      );

      openModal(item);
    }
  });

  // Keyboard accessibility.
  gallery.addEventListener("keydown", event => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches(".gallery-item")
    ) {
      event.preventDefault();

      const item = spaceImages.find(
        entry => entry.date === event.target.dataset.date
      );

      openModal(item);
    }
  });

  // --------------------------------------------
  // MODAL EVENTS
  // --------------------------------------------

  closeModalButton.addEventListener(
    "click",
    closeModal
  );

  // Close modal by clicking the backdrop.
  modal.addEventListener("click", event => {
    if (
      event.target.matches("[data-close-modal]")
    ) {
      closeModal();
    }
  });

  // Close modal with Escape.
  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !modal.hidden
    ) {
      closeModal();
    }
  });

  // Keep keyboard focus inside the modal.
  modal.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;

    const focusableElements = [
      ...modal.querySelectorAll(
        'button:not([disabled]), a[href], iframe'
      )
    ];

    if (!focusableElements.length) return;

    const first = focusableElements[0];
    const last =
      focusableElements[focusableElements.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  });

  // --------------------------------------------
  // THEME TOGGLE
  // --------------------------------------------

  themeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.toggle(
      "light-theme"
    );

    themeToggle.textContent =
      isLight ? "☾" : "☼";

    themeToggle.setAttribute(
      "aria-label",
      isLight
        ? "Switch to dark theme"
        : "Switch to light theme"
    );
  });
}


// ============================================================
// STEP 14 — START THE APPLICATION
// ============================================================

initializeApp();
