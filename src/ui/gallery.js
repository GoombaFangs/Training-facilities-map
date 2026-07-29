import { state } from '../state.js';

let currentType = null;
let arrowsBound = false;
let bigBtnBound = false;

/**
 * @param {{ imgArr?: string[] } | null} facilityType
 */
export function setupGallery(facilityType) {
  currentType = facilityType;
  state.currentImgIndex = 0;

  const images = facilityType?.imgArr ?? [];
  const container = document.getElementById('popUpImgContainer');
  const bigImg = document.getElementById('imgBigImg');
  const dots = document.getElementById('imgDots');

  if (images.length === 0) {
    container.style.backgroundImage = 'none';
    bigImg.removeAttribute('src');
    dots.innerHTML = '';
    setArrowsVisible(false);
    return;
  }

  showImage(images[0]);
  renderDots(images.length);
  setArrowsVisible(images.length > 1);
  bindControlsOnce();
}

export function resetGallery() {
  if (state.isImgBig) {
    collapseBigImage(true);
  }
}

function bindControlsOnce() {
  if (!arrowsBound) {
    document.querySelectorAll('.imgArrow').forEach((arrow) => {
      arrow.addEventListener('click', onArrowClick);
    });
    arrowsBound = true;
  }

  if (!bigBtnBound) {
    document.getElementById('bigImgBtn').addEventListener('click', onBigImgClick);
    bigBtnBound = true;
  }
}

function onArrowClick(event) {
  const images = currentType?.imgArr ?? [];
  if (images.length <= 1) return;

  if (event.currentTarget.id === 'arrowR') {
    state.currentImgIndex = (state.currentImgIndex + 1) % images.length;
  } else {
    state.currentImgIndex =
      (state.currentImgIndex - 1 + images.length) % images.length;
  }

  showImage(images[state.currentImgIndex]);
  updateDots();
}

function onBigImgClick() {
  if (!state.isImgBig) {
    expandBigImage();
  } else {
    collapseBigImage(false);
  }
}

function showImage(src) {
  const container = document.getElementById('popUpImgContainer');
  const bigImg = document.getElementById('imgBigImg');
  container.style.backgroundImage = `url("${src}")`;
  bigImg.src = src;
}

function renderDots(count) {
  const dots = document.getElementById('imgDots');
  dots.innerHTML = '';

  if (count <= 1) return;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = i === 0 ? 'imgDot is-active' : 'imgDot';
    dots.appendChild(dot);
  }
}

function updateDots() {
  document.querySelectorAll('.imgDot').forEach((dot, index) => {
    dot.classList.toggle('is-active', index === state.currentImgIndex);
  });
}

function setArrowsVisible(visible) {
  document.querySelectorAll('.imgArrow').forEach((arrow) => {
    arrow.style.display = visible ? 'block' : 'none';
  });
}

function expandBigImage() {
  const btn = document.getElementById('bigImgBtn');
  const overlay = document.getElementById('popUpBigImg');
  const img = document.getElementById('imgBigImg');

  btn.style.backgroundImage = "url('/assets/smallImgIcon.svg')";
  overlay.style.display = 'block';
  overlay.style.animation = 'popUpBigImgAnimation 1.5s ease';
  state.isImgBig = true;

  setTimeout(() => {
    img.style.opacity = '1';
  }, 1500);
}

function collapseBigImage(immediate) {
  const btn = document.getElementById('bigImgBtn');
  const overlay = document.getElementById('popUpBigImg');
  const img = document.getElementById('imgBigImg');

  btn.style.backgroundImage = "url('/assets/bigImgIcon.svg')";
  img.style.opacity = '0';
  state.isImgBig = false;

  if (immediate) {
    overlay.style.display = 'none';
    overlay.style.animation = '';
    return;
  }

  overlay.style.animation = 'popUpBigImgAnimationReverse 1.5s ease';
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 1500);
}
