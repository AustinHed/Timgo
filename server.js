const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Phrase list (replace with real phrases later) ---
const PHRASES = [
  "Does a terrible impression",
  "Blames it on the alcohol",
  "Starts a sentence and never finishes",
  "Brings up an ex unprompted",
  "Orders for the whole table",
  "Says 'trust me bro'",
  "Loses their phone",
  "Cries at a commercial",
  "Falls asleep standing up",
  "Talks to a dog for 5+ minutes",
  "Claims they could beat a pro athlete",
  "Sends a voice memo instead of texting",
  "Pronounces something embarrassingly wrong",
  "Gets lost despite GPS",
  "Buys a round for strangers",
  "Falls for an obvious scam",
  "Starts a conspiracy theory",
  "Does something illegal and brags about it",
  "Texts someone in the same room",
  "Spills a drink",
  "Leaves without saying goodbye",
  "Gives unsolicited life advice",
  "Sings along to a song they don't know",
  "Challenges someone twice their size",
  "Googles something they should know",
  "Gets too competitive at a party game",
  "Overshares with a stranger",
  "Takes 20 minutes to pick something off a menu",
  "Makes a face at their own joke",
  "Refuses to admit they're wrong",
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
