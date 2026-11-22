const cells = [...document.querySelectorAll('.game-cell')];
const positions = cells.map((cell) => cell.getAttribute('aria-label'));
const status = document.querySelector('#game-status');
const reset = document.querySelector('#game-reset');
const board = Array(9).fill('');
const lines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
let turn = 'X';
let winningLine = [];
let kittyTimer;

function renderBoard() {
  cells.forEach((cell, index) => {
    const mark = board[index];
    cell.firstElementChild.textContent = mark;
    cell.setAttribute('aria-label', `${positions[index]}, ${mark || 'empty'}`);
    cell.setAttribute('aria-disabled', String(Boolean(mark) || turn !== 'X'));
    cell.toggleAttribute('data-winning', winningLine.includes(index));
    if (mark) cell.dataset.mark = mark;
    else delete cell.dataset.mark;
  });
}

function finishRound(mark) {
  winningLine = lines.find((line) => line.every((index) => board[index] === mark)) || [];
  if (!winningLine.length && board.includes('')) return false;

  turn = '';
  status.textContent = 'It’s a draw.';
  if (winningLine.length) {
    status.textContent = mark === 'X' ? 'You win!' : 'Kitty wins this round!';
  }
  return true;
}

function finishingMove(mark) {
  for (const line of lines) {
    if (line.filter((index) => board[index] === mark).length === 2) {
      const open = line.find((index) => !board[index]);
      if (open !== undefined) return open;
    }
  }
}

function playKitty() {
  const open = cells.map((_, index) => index).filter((index) => !board[index]);
  const index = finishingMove('O') ?? finishingMove('X') ?? open[Math.floor(Math.random() * open.length)];
  board[index] = 'O';
  if (!finishRound('O')) {
    turn = 'X';
    status.textContent = `Kitty marked ${positions[index].toLowerCase()}. Your turn.`;
  }
  renderBoard();
}

function playX(index) {
  if (turn !== 'X' || board[index]) return;
  board[index] = 'X';
  if (!finishRound('X')) {
    turn = 'O';
    status.textContent = 'Kitty is thinking…';
    kittyTimer = setTimeout(playKitty, 350);
  }
  renderBoard();
}

cells.forEach((cell, index) => {
  cell.addEventListener('click', () => playX(index));
  cell.disabled = false;
});

reset.addEventListener('click', () => {
  clearTimeout(kittyTimer);
  board.fill('');
  winningLine = [];
  turn = 'X';
  status.textContent = 'Your turn. You’re X.';
  renderBoard();
  cells[0].focus();
});

reset.hidden = false;
status.textContent = 'Your turn. You’re X.';
renderBoard();
