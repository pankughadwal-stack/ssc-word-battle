
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

function roomState(room) {
  const r = rooms.get(room);
  return {
    room,
    players: r.players.map(p => ({id:p.id, name:p.name, score:p.score})),
    word: r.word,
    round: r.round,
    target: r.target,
    status: r.status
  };
}

function newWord() {
  const words = [
    "government","constitutional","environment","agriculture","development",
    "independent","legislation","democracy","administration","significant",
    "contemporary","equilibrium","population","authority","judiciary",
    "parliamentary","fundamental","consequence","efficient","inequality",
    "revolution","substantial","agriculture","phenomenon","responsibility",
    "transparent","opportunity","establishment","prohibition","amendment",
    "territory","sovereignty","committee","economic","fiscal","monetary",
    "industrial","biodiversity","conservation","sustainable","migration",
    "interpretation","perspective","inevitable","controversial","legitimate",
    "accelerate","persistent","vulnerable","subsidy","infrastructure"
  ];
  return words[Math.floor(Math.random()*words.length)];
}

io.on("connection", socket => {
  socket.on("join", ({room, name}) => {
    room = String(room || "").trim().toUpperCase().slice(0,10);
    name = String(name || "Player").trim().slice(0,18);
    if (!room) return;
    if (!rooms.has(room)) rooms.set(room, {players:[], word:"", round:0, target:30, status:"waiting"});
    const r = rooms.get(room);
    if (r.players.length >= 2 && !r.players.some(p=>p.id===socket.id)) {
      socket.emit("errorMsg","Room is full.");
      return;
    }
    let p = r.players.find(p=>p.id===socket.id);
    if (!p) { p={id:socket.id,name,score:0}; r.players.push(p); }
    socket.join(room);
    if (r.players.length === 2 && r.status === "waiting") {
      r.status="playing"; r.round=1; r.word=newWord();
    }
    io.to(room).emit("state", roomState(room));
  });

  socket.on("submit", ({room, text}) => {
    room = String(room || "").toUpperCase();
    const r=rooms.get(room);
    if (!r || r.status!=="playing") return;
    const p=r.players.find(x=>x.id===socket.id);
    if (!p) return;
    if (String(text||"").trim().toLowerCase() !== r.word.toLowerCase()) return;
    p.score++;
    if (p.score >= r.target) {
      r.status="finished";
      io.to(room).emit("state", roomState(room));
      return;
    }
    r.round++;
    r.word=newWord();
    io.to(room).emit("state", roomState(room));
  });

  socket.on("restart", ({room}) => {
    room=String(room||"").toUpperCase();
    const r=rooms.get(room);
    if (!r || r.players.length===0) return;
    r.players.forEach(p=>p.score=0);
    r.round=1; r.status=r.players.length===2?"playing":"waiting"; r.word=r.status==="playing"?newWord():"";
    io.to(room).emit("state", roomState(room));
  });

  socket.on("disconnect", () => {
    for (const [room,r] of rooms) {
      const i=r.players.findIndex(p=>p.id===socket.id);
      if(i>=0){ r.players.splice(i,1); r.status="waiting"; r.word=""; io.to(room).emit("state",roomState(room)); }
      if(r.players.length===0) rooms.delete(room);
    }
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("SSC Word Battle running on "+PORT));
