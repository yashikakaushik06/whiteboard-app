const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 1. Enhanced CORS for Chrome Extensions and Local Dev
const io = new Server(server, {
  cors: {
    origin: "*", // Allows connections from any origin (including chrome-extension://)
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // Helps with compatibility for different socket.io client versions
});

app.use(express.static("public"));

io.on("connection", (socket) => {
  // Log more detail to help debug
  console.log(`🟢 User Connected: ${socket.id}`);

  // WebRTC Signaling: relay messages to all OTHER connected peers
  socket.on("propagate", (data) => {
    // console.log(`Propagating data from ${socket.id}`); // Debug line
    socket.broadcast.emit("onpropagate", data);
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔴 User Disconnected: ${socket.id} | Reason: ${reason}`);
  });
});

// 2. Handle server-side errors to prevent crashing
server.on('error', (err) => {
  console.error('Server Error:', err);
});

const PORT = process.env.PORT || 8080; // Use environment port for deployment
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Whiteboard Server running at http://localhost:${PORT}`);
});
