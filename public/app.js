const FREE_INDEX = 12; // center of 5x5 grid

const WINNING_LINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

let masterPhrases = [];
let board = []; // array of 25: phrase string or null (free space)
let checkedSet = new Set(); // server-confirmed checked phrases

const socket = io();

const boardEl = document.getElementById('board');
const bingoBanner = document.getElementById('bingo-banner');
const otherBingoBanner = document.getElementById('other-bingo-banner');
const statusEl = document.getElementById('connection-status');
const resetBtn = document.getElementById('reset-btn');
const editBtn = document.getElementById('edit-btn');
const modalOverlay = document.getElementById('modal-overlay');
const phraseListEl = document.getElementById('phrase-list');
const phraseCountWarning = document.getElementById('phrase-count-warning');

let hasBingo = false;

// --- Socket events ---

socket.on('connect', () => {
  statusEl.textContent = 'Connected';
  statusEl.className = 'connected';
});

socket.on('disconnect', () => {
  statusEl.textContent = 'Disconnected';
  statusEl.className = 'disconnected';
});

socket.on('init', ({ gameId, phrases, checked }) => {
  masterPhrases = phrases;
  checkedSet = new Set(checked);
  board = loadOrGenerateBoard(gameId, phrases);
  render();
});

socket.on('phraseChecked', (phrase) => {
  checkedSet.add(phrase);
  updateCellState(phrase, true);
  checkBingo();
});

socket.on('phraseUnchecked', (phrase) => {
  checkedSet.delete(phrase);
  updateCellState(phrase, false);
  checkBingo();
});

socket.on('playerBingo', () => {
  otherBingoBanner.classList.remove('hidden');
});

socket.on('gameReset', ({ gameId }) => {
  checkedSet.clear();
  hasBingo = false;
  otherBingoBanner.classList.add('hidden');
  board = loadOrGenerateBoard(gameId, masterPhrases);
  render();
});

resetBtn.addEventListener('click', () => {
  if (confirm('Reset the game for everyone?')) {
    socket.emit('reset');
  }
});

// --- Edit modal ---

editBtn.addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.getElementById('add-phrase-btn').addEventListener('click', () => addPhraseRow(''));
document.getElementById('save-btn').addEventListener('click', saveChanges);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function openModal() {
  renderPhraseList(masterPhrases);
  modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderPhraseList(phrases) {
  phraseListEl.innerHTML = '';
  phrases.forEach(p => addPhraseRow(p));
  updateWarning();
}

function addPhraseRow(text) {
  const row = document.createElement('div');
  row.className = 'phrase-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = text;
  input.placeholder = 'Enter phrase…';
  input.addEventListener('input', updateWarning);

  const del = document.createElement('button');
  del.className = 'delete-phrase-btn';
  del.textContent = '✕';
  del.setAttribute('aria-label', 'Delete phrase');
  del.addEventListener('click', () => {
    row.remove();
    updateWarning();
  });

  row.appendChild(input);
  row.appendChild(del);
  phraseListEl.appendChild(row);

  // Focus the new input if it's a fresh add (empty)
  if (!text) input.focus();
}

function getCurrentPhrases() {
  return Array.from(phraseListEl.querySelectorAll('.phrase-row input'))
    .map(i => i.value.trim())
    .filter(v => v.length > 0);
}

function updateWarning() {
  const count = getCurrentPhrases().length;
  phraseCountWarning.classList.toggle('hidden', count >= 24);
  document.getElementById('save-btn').disabled = count < 24;
}

function saveChanges() {
  const updated = getCurrentPhrases();
  if (updated.length < 24) return;
  socket.emit('updatePhrases', updated);
  closeModal();
}

// --- Board generation ---

function loadOrGenerateBoard(gameId, phrases) {
  const stored = getStoredBoard();
  if (stored && stored.gameId === gameId) {
    return stored.board;
  }
  const newBoard = generateBoard(phrases);
  saveBoard(gameId, newBoard);
  return newBoard;
}

function generateBoard(phrases) {
  // Pick 24 random phrases (no duplicates), shuffle, insert FREE at center
  const shuffled = [...phrases].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 24);
  // Insert null (free space) at center index
  picked.splice(FREE_INDEX, 0, null);
  return picked;
}

function getStoredBoard() {
  try {
    return JSON.parse(localStorage.getItem('timgo_board'));
  } catch {
    return null;
  }
}

function saveBoard(gameId, board) {
  localStorage.setItem('timgo_board', JSON.stringify({ gameId, board }));
}

// --- Rendering ---

function render() {
  boardEl.innerHTML = '';
  bingoBanner.classList.add('hidden');

  board.forEach((phrase, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;

    if (phrase === null) {
      cell.classList.add('free', 'checked');
      cell.textContent = 'FREE';
    } else {
      cell.textContent = phrase;
      if (checkedSet.has(phrase)) {
        cell.classList.add('checked');
      }
      cell.addEventListener('click', () => onCellClick(phrase, cell));
    }

    boardEl.appendChild(cell);
  });

  checkBingo();
}

function updateCellState(phrase, checked) {
  board.forEach((p, i) => {
    if (p === phrase) {
      const cell = boardEl.children[i];
      if (cell) {
        cell.classList.toggle('checked', checked);
      }
    }
  });
}

function onCellClick(phrase, cell) {
  const isChecked = checkedSet.has(phrase);
  if (isChecked) {
    socket.emit('uncheck', phrase);
  } else {
    socket.emit('check', phrase);
  }
}

// --- Bingo detection ---

function checkBingo() {
  const checkedIndices = new Set();
  board.forEach((phrase, i) => {
    if (phrase === null || checkedSet.has(phrase)) {
      checkedIndices.add(i);
    }
  });

  Array.from(boardEl.children).forEach(cell => cell.classList.remove('winning'));

  let nowBingo = false;
  for (const line of WINNING_LINES) {
    if (line.every(i => checkedIndices.has(i))) {
      nowBingo = true;
      line.forEach(i => boardEl.children[i]?.classList.add('winning'));
    }
  }

  bingoBanner.classList.toggle('hidden', !nowBingo);

  // Notify others the first time this client gets bingo
  if (nowBingo && !hasBingo) {
    socket.emit('bingo');
  }
  hasBingo = nowBingo;
}
