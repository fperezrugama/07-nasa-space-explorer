// Find the controls and gallery elements we will use.
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const fetchButton = document.getElementById('fetchButton');
const gallery = document.getElementById('gallery');
const statusMessage = document.getElementById('statusMessage');
const resultsSummary = document.getElementById('resultsSummary');
const searchInput = document.getElementById('searchInput');
const favoritesToggle = document.getElementById('favoritesToggle');
const themeToggle = document.getElementById('themeToggle');
const modal = document.getElementById('modal');
const closeModalButton = document.getElementById('closeModal');
const modalMedia = document.getElementById('modalMedia');
const modalDate = document.getElementById('modalDate');
const modalTitle = document.getElementById('modalTitle');
const modalExplanation = document.getElementById('modalExplanation');
const modalLink = document.getElementById('modalLink');

// dateRange.js sets the valid dates and the default nine-day range.
setupDateInputs(startInput, endInput);

const API_URL = 'https://api.nasa.gov/planetary/apod';
// Keep the public demo key in this frontend. Personal keys should stay out of source control.
const API_KEY = 'DEMO_KEY';
let spaceImages = [];
let showingFavoritesOnly = false;
let favorites = JSON.parse(localStorage.getItem('nasaFavorites') || '[]');
let lastFocusedElement;
const requestCache = new Map();
let activeRequest = null;

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const shortenText = (text, length = 150) => text.length > length ? `${text.slice(0, length).trim()}…` : text;

function showStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function renderGallery() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const visibleImages = spaceImages.filter((image) => {
    const matchesSearch = image.title.toLowerCase().includes(searchTerm) ||
      image.explanation.toLowerCase().includes(searchTerm);
    const matchesFavorites = !showingFavoritesOnly || favorites.includes(image.date);
    return matchesSearch && matchesFavorites;
  });

  resultsSummary.textContent = `${visibleImages.length} ${visibleImages.length === 1 ? 'discovery' : 'discoveries'} found`;
  if (!visibleImages.length) {
    gallery.innerHTML = `<div class="placeholder"><div class="placeholder-icon">✦</div><p>No discoveries match your filters yet.</p></div>`;
    return;
  }

  gallery.innerHTML = visibleImages.map((image) => {
    const isFavorite = favorites.includes(image.date);
    const media = image.media_type === 'video'
      ? `<div class="video-preview"><span>▶</span><p>NASA video</p></div>`
      : `<img src="${image.url}" alt="${image.title}" loading="lazy" />`;
    return `
      <article class="gallery-item" data-date="${image.date}" tabindex="0">
        <div class="card-media">${media}<button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" data-favorite="${image.date}" type="button" aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">${isFavorite ? '♥' : '♡'}</button></div>
        <div class="card-content">
          <p class="card-date">${formatDate(image.date)}</p>
          <h2>${image.title}</h2>
          <p class="card-explanation">${shortenText(image.explanation)}</p>
          <button class="read-more" data-open="${image.date}" type="button">Read story <span>↗</span></button>
        </div>
      </article>`;
  }).join('');
}

async function getSpaceImages() {
  const startDate = startInput.value;
  const endDate = endInput.value;
  if (!startDate || !endDate) {
    showStatus('Please choose both a start and end date.', 'error');
    return;
  }

  const validDate = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsedDate = new Date(`${date}T00:00:00`);
    const [year, month, day] = date.split('-').map(Number);
    return parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() + 1 === month &&
      parsedDate.getUTCDate() === day;
  };
  if (!validDate(startDate) || !validDate(endDate) ||
      startDate < earliestDate || endDate > today) {
    showStatus('Choose dates between June 16, 1995 and today.', 'error');
    return;
  }
  if (startDate > endDate) {
    showStatus('The start date must be before the end date.', 'error');
    return;
  }

  const requestKey = `${startDate}:${endDate}`;
  if (activeRequest === requestKey) return;
  if (requestCache.has(requestKey)) {
    spaceImages = requestCache.get(requestKey);
    renderGallery();
    showStatus(`Archive loaded · ${formatDate(startDate)} — ${formatDate(endDate)}`, 'success');
    return;
  }

  const requestUrl = new URL(API_URL);
  requestUrl.search = new URLSearchParams({
    api_key: API_KEY,
    start_date: startDate,
    end_date: endDate
  });
  activeRequest = requestKey;
  fetchButton.disabled = true;
  fetchButton.innerHTML = 'Scanning the skies <span class="spinner"></span>';
  showStatus('Connecting to NASA…');
  gallery.innerHTML = '<div class="loading-state"><div class="loader"></div><p>Retrieving your cosmic discoveries</p></div>';

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`NASA API request failed with status ${response.status}`);
    }
    const results = await response.json();
    spaceImages = results.sort((a, b) => b.date.localeCompare(a.date));
    requestCache.set(requestKey, spaceImages);
    renderGallery();
    showStatus(`Archive loaded · ${formatDate(startDate)} — ${formatDate(endDate)}`, 'success');
  } catch (error) {
    console.error(error);
    gallery.innerHTML = '<div class="placeholder"><div class="placeholder-icon">📡</div><p>We could not reach NASA right now. Please check your connection and try again.</p></div>';
    showStatus('Unable to load the archive. Please try again.', 'error');
  } finally {
    activeRequest = null;
    fetchButton.disabled = false;
    fetchButton.innerHTML = 'Get Space Images <span>↗</span>';
  }
}

function toggleFavorite(date) {
  favorites = favorites.includes(date) ? favorites.filter((item) => item !== date) : [...favorites, date];
  localStorage.setItem('nasaFavorites', JSON.stringify(favorites));
  renderGallery();
}

function openModal(image) {
  lastFocusedElement = document.activeElement;
  modalMedia.innerHTML = image.media_type === 'video'
    ? `<iframe src="${image.url}" title="${image.title}" allowfullscreen></iframe>`
    : `<img src="${image.hdurl || image.url}" alt="${image.title}" />`;
  modalDate.textContent = formatDate(image.date);
  modalTitle.textContent = image.title;
  modalExplanation.textContent = image.explanation;
  modalLink.href = image.url;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  closeModalButton.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastFocusedElement) lastFocusedElement.focus();
}

fetchButton.addEventListener('click', getSpaceImages);
searchInput.addEventListener('input', renderGallery);
favoritesToggle.addEventListener('click', () => {
  showingFavoritesOnly = !showingFavoritesOnly;
  favoritesToggle.classList.toggle('active', showingFavoritesOnly);
  favoritesToggle.setAttribute('aria-pressed', showingFavoritesOnly);
  renderGallery();
});
gallery.addEventListener('click', (event) => {
  const favoriteButton = event.target.closest('[data-favorite]');
  const openButton = event.target.closest('[data-open]');
  const galleryItem = event.target.closest('.gallery-item');
  if (favoriteButton) {
    event.stopPropagation();
    toggleFavorite(favoriteButton.dataset.favorite);
  } else if (openButton) {
    openModal(spaceImages.find((image) => image.date === openButton.dataset.open));
  } else if (galleryItem) {
    openModal(spaceImages.find((image) => image.date === galleryItem.dataset.date));
  }
});
gallery.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.gallery-item')) {
    event.preventDefault();
    openModal(spaceImages.find((image) => image.date === event.target.dataset.date));
  }
});
closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target.matches('[data-close-modal]')) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
});
themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');
  themeToggle.textContent = isLight ? '☾' : '☼';
  themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
});
