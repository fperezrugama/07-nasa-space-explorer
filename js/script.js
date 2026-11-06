// Find the controls and gallery elements we will use.
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const fetchButton = document.getElementById('fetchButton');
const gallery = document.getElementById('gallery');
const statusMessage = document.getElementById('statusMessage');
const selectedRange = document.getElementById('selectedRange');
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

// The Worker adds NASA_API_KEY server-side. Never put a personal key in this file.
const APOD_PROXY_URL = 'https://nasa-apod-proxy.YOUR_SUBDOMAIN.workers.dev/api/apod';
let spaceImages = [];
let showingFavoritesOnly = false;
let favorites = JSON.parse(localStorage.getItem('nasaFavorites') || '[]');
let lastFocusedElement;
const requestCache = new Map();
let activeRequest = null;
let requestId = 0;
const spaceFacts = [
  'Jupiter’s Great Red Spot is a storm that has raged for at least 150 years.',
  'The Milky Way galaxy is about 100,000 light-years across.',
  'Light travels through space at about 300,000 kilometers per second.',
  'Saturn’s rings are made mostly of pieces of water ice and rock.',
  'A day on Venus is longer than a year on Venus.',
  'Mars has the tallest volcano in the Solar System, Olympus Mons.',
  'A black hole’s gravity is so strong that even light cannot escape its event horizon.',
  'Neutron stars can spin more than 600 times every second.',
  'The footprints left on the Moon could last for millions of years.',
  'Jupiter is so large that more than 1,300 Earths could fit inside it.',
  'Light from the Sun takes about eight minutes to reach Earth.',
  'Saturn would float in water because its average density is lower than water.',
  'The Sun contains more than 99 percent of the total mass in our Solar System.',
  'The Moon is moving away from Earth by about 3.8 centimeters each year.'
];

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const shortenText = (text, length = 150) => text.length > length ? `${text.slice(0, length).trim()}…` : text;

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsedDate = new Date(`${date}T00:00:00`);
  const [year, month, day] = date.split('-').map(Number);
  return parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() + 1 === month &&
    parsedDate.getUTCDate() === day;
}

function readDateRange() {
  const startDate = startInput.value;
  const endDate = endInput.value;
  if (!startDate || !endDate) {
    throw new Error('Please choose both a start and end date.');
  }
  if (!isValidDate(startDate) || !isValidDate(endDate) ||
      startDate < earliestDate || endDate > today) {
    throw new Error('Choose dates between June 16, 1995 and today.');
  }
  if (startDate > endDate) {
    throw new Error('The start date must be before the end date.');
  }
  return { startDate, endDate };
}

async function fetchApodData(startDate, endDate) {
  const requestUrl = new URL(APOD_PROXY_URL);
  requestUrl.search = new URLSearchParams({
    start_date: startDate,
    end_date: endDate
  });

  // async/await keeps the request steps readable while fetch waits for NASA's response.
  const response = await fetch(requestUrl);
  if (!response.ok) {
    let serviceMessage = '';
    try {
      const errorData = await response.json();
      serviceMessage = typeof errorData.error === 'string' ? errorData.error : '';
    } catch (error) {
      serviceMessage = '';
    }
    if (response.status === 429) {
      throw new Error(serviceMessage || 'NASA is rate-limiting requests. Please wait a moment and try again.');
    }
    throw new Error(serviceMessage || `NASA service request failed with status ${response.status}`);
  }

  // NASA returns JSON entries. Convert a single entry to an array for one rendering path.
  const responseData = await response.json();
  const results = Array.isArray(responseData) ? responseData : [responseData];
  return results
    .filter((image) => image && image.date && image.title && image.explanation &&
      (image.media_type === 'image' || image.media_type === 'video'))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getImageUrl(image) {
  if (image.media_type !== 'image') return null;
  const candidate = image.hdurl || image.url;
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const isKnownPlaceholder = url.pathname.includes('nasa-logo') ||
      (url.hostname === 'science.nasa.gov' && url.pathname.includes('/themes/'));
    const isArticleUrl = /\/(article|news|missions|blog)\//i.test(url.pathname);
    const hasImagePath = /\.(avif|gif|jpe?g|png|webp)$/i.test(url.pathname) ||
      /\/(image|images|uploads)\//i.test(url.pathname);
    const isScienceArticle = url.hostname === 'science.nasa.gov' && !hasImagePath;
    return url.protocol === 'https:' && !isKnownPlaceholder &&
      !isArticleUrl && !isScienceArticle ? url.href : null;
  } catch (error) {
    return null;
  }
}

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

// Show a different astronomy fact whenever the page loads.
showRandomFact();

function showStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function renderGallery() {
  // Build cards with DOM methods so NASA text is treated as text, not HTML.
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
    card.className = image.media_type === 'video' ? 'gallery-item video-card' : 'gallery-item';
    card.dataset.date = image.date;
    card.tabIndex = 0;

    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'card-media';
    if (image.media_type === 'video') {
      mediaContainer.append(createVideoPreview(image));
    } else {
      const imageUrl = getImageUrl(image);
      if (imageUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.src = imageUrl;
        thumbnail.alt = image.alt || image.title;
        thumbnail.loading = 'lazy';
        thumbnail.addEventListener('error', () => {
          thumbnail.replaceWith(createUnavailableMedia('Image unavailable'));
        });
        mediaContainer.append(thumbnail);
      } else {
        mediaContainer.append(createUnavailableMedia('Image unavailable'));
      }
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

function createVideoPreview(image) {
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
  return videoPreview;
}

function createUnavailableMedia(label) {
  const unavailable = document.createElement('div');
  unavailable.className = 'unavailable-media';
  unavailable.textContent = label;
  return unavailable;
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

function showErrorState(message, showRetry = false) {
  showEmptyState('📡', message);
  if (showRetry) {
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.type = 'button';
    retryButton.textContent = 'Retry request';
    retryButton.addEventListener('click', getSpaceImages);
    gallery.querySelector('.placeholder').append(retryButton);
  }
}

async function getSpaceImages() {
  let dateRange;
  try {
    dateRange = readDateRange();
  } catch (error) {
    showStatus(error.message, 'error');
    return;
  }
  const { startDate, endDate } = dateRange;

  const requestKey = `${startDate}:${endDate}`;
  if (activeRequest === requestKey) return;
  if (requestCache.has(requestKey)) {
    spaceImages = requestCache.get(requestKey);
    renderGallery();
    selectedRange.textContent = `${formatDate(startDate)} — ${formatDate(endDate)}`;
    showStatus(`Archive loaded · ${formatDate(startDate)} — ${formatDate(endDate)}`, 'success');
    return;
  }

  activeRequest = requestKey;
  const currentRequestId = ++requestId;
  fetchButton.disabled = true;
  fetchButton.innerHTML = 'Scanning the skies <span class="spinner"></span>';
  showStatus('Loading space photos…');
  showLoadingState();

  try {
    const results = await fetchApodData(startDate, endDate);
    if (currentRequestId !== requestId) return;
    spaceImages = results;
    requestCache.set(requestKey, spaceImages);
    if (spaceImages.length) {
      renderGallery();
      selectedRange.textContent = `${formatDate(startDate)} — ${formatDate(endDate)}`;
      showStatus(`Archive loaded · ${formatDate(startDate)} — ${formatDate(endDate)}`, 'success');
    } else {
      showEmptyState('✦', 'NASA returned no usable discoveries for these dates.');
      showStatus('No space photos were available for this range.', 'error');
    }
  } catch (error) {
    if (currentRequestId !== requestId) return;
    console.error(error);
    showErrorState(error.message.includes('rate-limiting')
      ? error.message
      : 'We could not load NASA’s space photos. Check your connection and try again.', true);
    showStatus(error.message.includes('rate-limiting')
      ? error.message
      : 'Unable to load the archive. Please try again.', 'error');
  } finally {
    if (currentRequestId === requestId) {
      activeRequest = null;
      fetchButton.disabled = false;
      fetchButton.innerHTML = 'Get Space Images <span>↗</span>';
    }
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
    // Videos get an iframe only for known safe embed hosts; other URLs use the source link.
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
    const imageUrl = getImageUrl(image);
    if (imageUrl) {
      const imageElement = document.createElement('img');
      imageElement.src = imageUrl;
      imageElement.alt = image.alt || image.title;
      imageElement.addEventListener('error', () => {
        modalMedia.replaceChildren(createUnavailableMedia('Image unavailable'));
      });
      modalMedia.append(imageElement);
    } else {
      modalMedia.append(createUnavailableMedia('Image unavailable'));
    }
  }

  modalDate.textContent = formatDate(image.date);
  modalTitle.textContent = image.title;
  modalExplanation.textContent = image.explanation;
  modalLink.href = image.permalink || image.url || '#';
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

function initializeApp() {
  fetchButton.addEventListener('click', getSpaceImages);
  newFactButton.addEventListener('click', showRandomFact);
  searchInput.addEventListener('input', renderGallery);
  favoritesToggle.addEventListener('click', () => {
    showingFavoritesOnly = !showingFavoritesOnly;
    favoritesToggle.classList.toggle('active', showingFavoritesOnly);
    favoritesToggle.setAttribute('aria-pressed', showingFavoritesOnly);
    renderGallery();
  });
  // One delegated listener handles clicks for dynamically created gallery cards.
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
  // Modal keyboard events support Escape and keep Tab focus inside the dialog.
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
}

initializeApp();
