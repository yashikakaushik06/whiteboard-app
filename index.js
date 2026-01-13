const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true 
});

app.use(express.static("public"));

io.on("connection", (socket) => {
  
  console.log(` User Connected: ${socket.id}`);

  
  socket.on("propagate", (data) => {
   
    socket.broadcast.emit("onpropagate", data);
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔴 User Disconnected: ${socket.id} | Reason: ${reason}`);
  });
});


server.on('error', (err) => {
  console.error('Server Error:', err);
});

const PORT = 8080; 
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Whiteboard Server running at http://localhost:${PORT}`);

});
