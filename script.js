const canvas = document.getElementById("canvas");
const test = document.getElementById("test");

// UI Elements
const colorPicker = document.getElementById("colorPicker");
const sizeSlider = document.getElementById("sizeSlider");
const drawBtn = document.getElementById("drawBtn");
const eraserBtn = document.getElementById("eraserBtn");
const clearBtn = document.getElementById("clearBtn");

// Set canvas size
canvas.width = window.innerWidth * 0.95;
canvas.height = window.innerHeight * 0.8;

const ctx = canvas.getContext("2d");

let x, y;
let mouseDown = false;
let isEraser = false; 
let dataChannel;

// Connection to local server
const socket = io("http://localhost:8080");

// ---------- UI Interaction Logic ----------

eraserBtn.onclick = () => {
    isEraser = true;
    eraserBtn.classList.add("active");
    drawBtn.classList.remove("active");
};

drawBtn.onclick = () => {
    isEraser = false;
    drawBtn.classList.add("active");
    eraserBtn.classList.remove("active");
};

clearBtn.onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dataChannel?.readyState === "open") {
        dataChannel.send(JSON.stringify({ clear: true }));
    }
};

// ---------- WebRTC Configuration ----------
const servers = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

const pc = new RTCPeerConnection(servers);
let remoteStream = new MediaStream();

// ---------- DataChannel handling ----------
function setupDataChannel(channel) {
  dataChannel = channel;

  dataChannel.onopen = () => console.log("✅ DataChannel open");
  
  dataChannel.onmessage = (e) => {
    const data = JSON.parse(e.data);
    
    // Remote Action: Clear
    if (data.clear) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Remote Action: Style Sync (Fixes the color/size for remote user)
    if (data.style) {
        ctx.strokeStyle = data.style.color;
        ctx.lineWidth = data.style.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }

    if (data.down) {
      ctx.beginPath();
      ctx.moveTo(data.down.x, data.down.y);
    }
    if (data.draw) {
      ctx.lineTo(data.draw.x, data.draw.y);
      ctx.stroke();
    }
  };
}

pc.ondatachannel = (e) => {
  console.log("📥 Received remote DataChannel");
  setupDataChannel(e.channel);
};

// ---------- Media ----------
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then((stream) => {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  })
  .catch(err => console.error("Media error:", err));

pc.ontrack = (event) => {
  event.streams[0].getTracks().forEach((track) => {
    remoteStream.addTrack(track);
  });
  test.srcObject = remoteStream;
};

// ---------- ICE Candidates ----------
pc.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("propagate", { ice: event.candidate });
  }
};

// ---------- Signaling Logic ----------
socket.on("onpropagate", async (data) => {
  try {
    if (data.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("propagate", { answer });
    } 
    else if (data.answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } 
    else if (data.ice) {
      await pc.addIceCandidate(new RTCIceCandidate(data.ice));
    }
  } catch (err) {
    console.error("Signaling Error:", err);
  }
});

const initCall = async () => {
  console.log("🚀 Initiating Call...");
  setupDataChannel(pc.createDataChannel("draw"));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("propagate", { offer });
};

window.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') initCall(); 
});

// ---------- Drawing Logic (Fixed for Border & Color) ----------

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

window.onmousedown = (e) => {
  const pos = getMousePos(e);
  x = pos.x;
  y = pos.y;
  mouseDown = true;

  // Update local style from UI
  const currentColor = isEraser ? "#FFFFFF" : colorPicker.value;
  const currentSize = sizeSlider.value;

  ctx.strokeStyle = currentColor;
  ctx.lineWidth = currentSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  ctx.beginPath();
  ctx.moveTo(x, y);

  if (dataChannel?.readyState === "open") {
    // Sync the style to the peer so they use the right color
    dataChannel.send(JSON.stringify({ 
        style: { color: currentColor, size: currentSize },
        down: { x, y } 
    }));
  }
};

window.onmouseup = () => {
    mouseDown = false;
    ctx.closePath();
};

window.onmousemove = (e) => {
  if (!mouseDown) return;
  
  const pos = getMousePos(e);
  
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  if (dataChannel?.readyState === "open") {
    dataChannel.send(JSON.stringify({ draw: { x: pos.x, y: pos.y } }));
  }
};

// Add Download Button to the Toolbar
const downloadBtn = document.createElement('button');
downloadBtn.innerText = "DOWNLOAD";
downloadBtn.className = "tool-btn";
downloadBtn.id = "downloadBtn";
document.querySelector('.toolbar').appendChild(downloadBtn);

// Logic to save the canvas as an image
downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'whiteboard-drawing.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
};
