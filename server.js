const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Phrase list ---
const PHRASES = [
  "Tim says the N-word (hard R)",
  "Tim brings up Israel first",
  "Tim says \"we should bomb Israel\"",
  "Tim says \"you know… Black people\"",
  "Tim says \"gook\"",
  "Tim says \"we should kill all politicians\"",
  "Tim says he beat his girlfriend",
  "Tim says his girlfriend beats him",
  "Tim uses a slur for Jews",
  "Tim calls Ed a faggot (nicely)",
  "Tim talks about his brother being a \"shower\"",
  "Tim mentions one of his credit cards",
  "Tim does ketamine",
  "Tim says he's thinking about getting a new bike",
  "Tim says \"meow\"",
  "Tim says he loves his job, then says he hates it",
  "Tim says \"I'm not a Republican\"",
  "Tim says \"wanna see my gun\"",
  "Tim says \"low key\"",
  "Tim says \"I'm a horse\"",
  "Tim says \"gonna put myself in the hole\"",
  "Tim says \"I'm feeling Chinese\"",
  "Tim says \"I'll text Bradley\"",
  "Tim says \"I saw it on Facebook Marketplace\"",
  "Tim says \"Nick\"",
  "Tim says \"me when I get you\"",
  "Tim plays Clash Royale in a social setting",
];

// --- Game state ---
let gameId = crypto.randomUUID();
let checkedPhrases = new Set();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  // Send full state to newly connected client
  socket.emit('init', {
    gameId,
    phrases: PHRASES,
    checked: Array.from(checkedPhrases),
  });

  socket.on('check', (phrase) => {
    if (!PHRASES.includes(phrase)) return;
    checkedPhrases.add(phrase);
    io.emit('phraseChecked', phrase);
  });

  socket.on('uncheck', (phrase) => {
    if (!PHRASES.includes(phrase)) return;
    checkedPhrases.delete(phrase);
    io.emit('phraseUnchecked', phrase);
  });

  socket.on('bingo', () => {
    socket.broadcast.emit('playerBingo');
  });

  socket.on('reset', () => {
    checkedPhrases.clear();
    gameId = crypto.randomUUID();
    io.emit('gameReset', { gameId });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Timgo running on http://localhost:${PORT}`);
});
