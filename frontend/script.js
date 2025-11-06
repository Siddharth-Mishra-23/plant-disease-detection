// 🌿 Backend Base URL (Update if Codespace URL changes)
const backendBase = "https://orange-spoon-7vvjq4jgv5qv3r44g-5000.app.github.dev";

let selectedFile = null;
let cameraStream = null;
let cameraActive = false;
let capturedViaCamera = false;

// ------------------- FILE UPLOAD -------------------

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile = file;
    capturedViaCamera = false;
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('result').innerText = "✅ File selected. Ready to upload.";
  }
}

// ------------------- CAMERA MODE -------------------

async function startCamera() {
  if (cameraActive) return; // Prevent reinitialization
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream = stream;
    const video = document.getElementById('cameraFeed');
    video.srcObject = stream;
    document.getElementById('cameraContainer').style.display = 'block';
    cameraActive = true;
  } catch (err) {
    alert("⚠️ Camera access denied or unavailable.");
    console.error(err);
  }
}

function captureImage() {
  const video = document.getElementById('cameraFeed');
  const canvas = document.getElementById('cameraCanvas');
  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert image to blob for upload
  canvas.toBlob(blob => {
    selectedFile = new File([blob], "captured.jpg", { type: "image/jpeg" });
    capturedViaCamera = true;

    // Show preview while keeping camera on
    const previewImg = document.getElementById('capturedImage');
    previewImg.src = URL.createObjectURL(blob);
    document.getElementById('cameraPreview').style.display = 'block';
    document.getElementById('retakeBtn').style.display = 'inline-block';
    document.getElementById('uploadBtn').disabled = false;
  }, 'image/jpeg');
}

function retakeImage() {
  selectedFile = null;
  document.getElementById('cameraPreview').style.display = 'none';
  document.getElementById('retakeBtn').style.display = 'none';
  document.getElementById('uploadBtn').disabled = true;
  document.getElementById('result').innerText = "🔁 Ready to capture a new photo.";
}

// ------------------- UPLOAD -------------------

async function uploadImage() {
  const resultDiv = document.getElementById('result');
  if (!selectedFile) {
    resultDiv.innerText = "⚠️ Please select or capture an image first!";
    return;
  }

  const formData = new FormData();
  formData.append('image', selectedFile);

  // Show analyzing animation before upload
  resultDiv.innerHTML = `
    <div class="loader"></div>
    <p class="loading-text">Analyzing Leaf...</p>
    <div class="progress-container">
      <div class="progress-bar"></div>
    </div>
  `;

  // Simulate AI processing delay
  setTimeout(async () => {
    try {
      const response = await fetch(`${backendBase}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (data.message) {
        resultDiv.innerText = "✅ " + data.message;
        showPrediction(data.disease || "Processing...", data.confidence || "0.0");

        // ✅ Turn off camera after upload
        if (capturedViaCamera && cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          cameraStream = null;
          cameraActive = false;
          document.getElementById('cameraFeed').srcObject = null;
          document.getElementById('cameraContainer').style.display = 'none';
          capturedViaCamera = false;
        }

      } else {
        resultDiv.innerText = "❌ " + data.error;
      }
    } catch (error) {
      resultDiv.innerText = "❌ Error connecting to backend!";
      console.error(error);
    }
  }, 2500); // 2.5s animation before showing result
}

// ------------------- PREDICTION DISPLAY -------------------

function showPrediction(disease, confidence) {
  const resultBox = document.getElementById('predictionResult');
  document.getElementById('diseaseName').innerText = `🌿 Disease: ${disease}`;
  document.getElementById('confidenceScore').innerText = `📈 Confidence: ${confidence.toFixed ? confidence.toFixed(2) : confidence}%`;

  const tips = {
    "Tomato Early Blight": "🪴 Use neem oil and remove infected leaves.",
    "Potato Late Blight": "🌦 Avoid water on leaves; apply copper-based fungicide.",
    "Apple Scab": "🍎 Prune infected branches; ensure good air flow.",
    "Corn Rust": "🌽 Rotate crops and use resistant hybrids.",
    "Healthy Leaf": "✅ No issues detected. Maintain regular watering.",
    "Mango Anthracnose": "🥭 Spray with copper fungicide during flowering.",
    "Pepper Bell Bacterial Spot": "🌶️ Avoid overhead watering; use disease-free seeds."
  };

  document.getElementById('preventionTips').innerText =
    tips[disease] || "💡 Keep monitoring and ensure proper sunlight and water balance.";

  // Smooth fade-in effect
  resultBox.style.display = 'block';
  resultBox.style.animation = 'fadeIn 1.2s ease forwards';
}

// ------------------- HISTORY -------------------

async function loadHistory() {
  const historyDiv = document.getElementById('historyTable');
  historyDiv.innerHTML = "<p>⏳ Loading history...</p>";

  try {
    const response = await fetch(`${backendBase}/history`);
    const data = await response.json();
    const history = data.history;

    if (!history || history.length === 0) {
      historyDiv.innerHTML = "<p>No uploads yet.</p>";
      return;
    }

    let tableHTML = `
      <table>
        <tr>
          <th>ID</th>
          <th>Filename</th>
          <th>Disease</th>
          <th>Confidence</th>
          <th>Timestamp</th>
        </tr>`;
    history.forEach(item => {
      tableHTML += `
        <tr>
          <td>${item.id}</td>
          <td>${item.filename}</td>
          <td>${item.disease}</td>
          <td>${item.confidence}%</td>
          <td>${item.timestamp}</td>
        </tr>`;
    });
    tableHTML += "</table>";
    historyDiv.innerHTML = tableHTML;
  } catch (error) {
    console.error(error);
    historyDiv.innerHTML = "<p>❌ Error loading history!</p>";
  }
}
