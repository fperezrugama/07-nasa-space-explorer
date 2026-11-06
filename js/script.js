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
const spaceFact = document.getElementById('spaceFact');
const newFactButton = document.getElementById('newFactButton');
const modal = document.getElementById('modal');
const appContainer = document.querySelector('.container');
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
const spaceFacts = [
  'A day on Venus is longer than a year on Venus.',
  'Neutron stars can spin more than 600 times every second.',
  'The footprints left on the Moon could last for millions of years.',
  'Jupiter is so large that more than 1,300 Earths could fit inside it.',
  'Light from the Sun takes about eight minutes to reach Earth.',
  'Saturn would float in water because its average density is lower than water.'
];

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const shortenText = (text, length = 150) => text.length > length ? `${text.slice(0, length).trim()}…` : text;

function getVideoEmbedUrl(videoUrl) {
  try {
    const url = new URL(videoUrl);
    if (url.protocol !== 'https:') return null;

    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1);
      return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null;
    }

    if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
      const videoId = url.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null;
    }

    if (url.hostname === 'vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      return videoId && /^\d+$/.test(videoId) ? `https://player.vimeo.com/video/${videoId}` : null;
    }

    if (url.hostname === 'player.vimeo.com' && url.pathname.startsWith('/video/')) {
      return url.href;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function showRandomFact() {
  const currentFact = spaceFact.textContent;
  const availableFacts = spaceFacts.filter((fact) => fact !== currentFact);
  spaceFact.textContent = availableFacts[Math.floor(Math.random() * availableFacts.length)];
}

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
    showEmptyState('✦', 'No discoveries match your filters yet.');
    return;
  }

  gallery.replaceChildren(...visibleImages.map((image) => {
    const isFavorite = favorites.includes(image.date);
    const card = document.createElement('article');
    card.className = 'gallery-item';
    card.dataset.date = image.date;
    card.tabIndex = 0;

    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'card-media';
    if (image.media_type === 'video') {
      const videoPreview = document.createElement('div');
      videoPreview.className = 'video-preview';
      if (image.thumbnail_url) {
        const thumbnail = document.createElement('img');
        thumbnail.className = 'video-thumbnail';
        thumbnail.src = image.thumbnail_url;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.addEventListener('error', () => thumbnail.remove());
        videoPreview.append(thumbnail);
      }
      const playIcon = document.createElement('span');
      playIcon.textContent = '▶';
      const videoLabel = document.createElement('p');
      videoLabel.textContent = 'Watch Video';
      videoPreview.append(playIcon, videoLabel);
      mediaContainer.append(videoPreview);
    } else {
      const thumbnail = document.createElement('img');
      thumbnail.src = image.url;
      thumbnail.alt = image.title;
      thumbnail.loading = 'lazy';
      mediaContainer.append(thumbnail);
    }

    const favoriteButton = document.createElement('button');
    favoriteButton.className = `favorite-button ${isFavorite ? 'is-favorite' : ''}`;
    favoriteButton.dataset.favorite = image.date;
    favoriteButton.type = 'button';
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favoriteButton.textContent = isFavorite ? '♥' : '♡';
    mediaContainer.append(favoriteButton);

    const content = document.createElement('div');
    content.className = 'card-content';
    const date = document.createElement('p');
    date.className = 'card-date';
    date.textContent = formatDate(image.date);
    const title = document.createElement('h2');
    title.textContent = image.title;
    const explanation = document.createElement('p');
    explanation.className = 'card-explanation';
    explanation.textContent = shortenText(image.explanation);
    const readMore = document.createElement('button');
    readMore.className = 'read-more';
    readMore.dataset.open = image.date;
    readMore.type = 'button';
    readMore.textContent = image.media_type === 'video' ? 'Watch Video ↗' : 'Read story ↗';
    content.append(date, title, explanation, readMore);
    card.append(mediaContainer, content);
    return card;
  }));
}

function showEmptyState(icon, message) {
  gallery.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder';
  const iconElement = document.createElement('div');
  iconElement.className = 'placeholder-icon';
  iconElement.textContent = icon;
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  placeholder.append(iconElement, messageElement);
  gallery.append(placeholder);
}

function showLoadingState() {
  gallery.replaceChildren();
  const loadingState = document.createElement('div');
  loadingState.className = 'loading-state';
  const loader = document.createElement('div');
  loader.className = 'loader';
  const message = document.createElement('p');
  message.textContent = 'Loading space photos…';
  loadingState.append(loader, message);
  gallery.append(loadingState);
}

function showErrorState(message) {
  showEmptyState('📡', message);
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
  showStatus('Loading space photos…');
  showLoadingState();

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('NASA is rate-limiting requests. Please wait a moment and try again.');
      }
      throw new Error(`NASA API request failed with status ${response.status}`);
    }
    const responseData = await response.json();
    const results = Array.isArray(responseData) ? responseData : [responseData];
    spaceImages = results
      .filter((image) => image && image.date && image.title && image.explanation &&
        (image.media_type === 'image' || image.media_type === 'video') && image.url)
      .sort((a, b) => b.date.localeCompare(a.date));
    requestCache.set(requestKey, spaceImages);
    if (spaceImages.length) {
      renderGallery();
      showStatus(`Archive loaded · ${formatDate(startDate)} — ${formatDate(endDate)}`, 'success');
    } else {
      showEmptyState('✦', 'NASA returned no usable discoveries for these dates.');
      showStatus('No space photos were available for this range.', 'error');
    }
  } catch (error) {
    console.error(error);
    showErrorState(error.message.includes('rate-limiting')
      ? error.message
      : 'We could not load NASA’s space photos. Check your connection and try again.');
    showStatus(error.message.includes('rate-limiting')
      ? error.message
      : 'Unable to load the archive. Please try again.', 'error');
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
  if (!image) return;
  lastFocusedElement = document.activeElement.closest('.gallery-item') || document.activeElement;
  modalMedia.replaceChildren();

  if (image.media_type === 'video') {
    const embedUrl = getVideoEmbedUrl(image.url);
    if (embedUrl) {
      const video = document.createElement('iframe');
      video.src = embedUrl;
      video.title = image.title;
      video.allowFullscreen = true;
      video.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      modalMedia.append(video);
    } else {
      const videoPreview = document.createElement('div');
      videoPreview.className = 'modal-video-placeholder';
      videoPreview.textContent = 'This video opens on its original website.';
      modalMedia.append(videoPreview);
    }
  } else {
    const imageElement = document.createElement('img');
    imageElement.src = image.hdurl || image.url;
    imageElement.alt = image.title;
    modalMedia.append(imageElement);
  }

  modalDate.textContent = formatDate(image.date);
  modalTitle.textContent = image.title;
  modalExplanation.textContent = image.explanation;
  modalLink.href = image.url;
  modalLink.textContent = image.media_type === 'video' ? 'Watch original video ↗' : 'View original on NASA.gov ↗';
  modal.hidden = false;
  appContainer.inert = true;
  document.body.classList.add('modal-open');
  closeModalButton.focus();
}

function closeModal() {
  modal.hidden = true;
  appContainer.inert = false;
  document.body.classList.remove('modal-open');
  if (lastFocusedElement) lastFocusedElement.focus();
}

fetchButton.addEventListener('click', getSpaceImages);
newFactButton.addEventListener('click', showRandomFact);
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
modal.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;

  const focusableElements = modal.querySelectorAll('button, a[href], iframe');
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  if (event.shiftKey && document.activeElement === firstFocusable) {
    event.preventDefault();
    lastFocusable.focus();
  } else if (!event.shiftKey && document.activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable.focus();
  }
});
themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');
  themeToggle.textContent = isLight ? '☾' : '☼';
  themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
});
