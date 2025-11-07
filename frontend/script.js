// 🌿 Backend Base URL (Render Deployment)
const backendBase = "https://plant-disease-detection-c0s9.onrender.com";

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
    document.getElementById("uploadBtn").disabled = false;
    document.getElementById("result").innerText =
      "✅ File selected. Ready to upload.";
  }
}

// ------------------- CAMERA MODE -------------------

async function startCamera() {
  if (cameraActive) return; // Prevent reinitialization
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream = stream;
    const video = document.getElementById("cameraFeed");
    video.srcObject = stream;
    document.getElementById("cameraContainer").style.display = "block";
    cameraActive = true;
  } catch (err) {
    alert("⚠️ Camera access denied or unavailable.");
    console.error(err);
  }
}

function captureImage() {
  const video = document.getElementById("cameraFeed");
  const canvas = document.getElementById("cameraCanvas");
  const context = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert image to blob for upload
  canvas.toBlob(
    (blob) => {
      selectedFile = new File([blob], "captured.jpg", { type: "image/jpeg" });
      capturedViaCamera = true;

      // Show preview while keeping camera on
      const previewImg = document.getElementById("capturedImage");
      previewImg.src = URL.createObjectURL(blob);
      document.getElementById("cameraPreview").style.display = "block";
      document.getElementById("retakeBtn").style.display = "inline-block";
      document.getElementById("uploadBtn").disabled = false;
      document.getElementById("result").innerText =
        "📸 Image captured successfully!";
    },
    "image/jpeg",
    0.9
  );
}

function retakeImage() {
  selectedFile = null;
  document.getElementById("cameraPreview").style.display = "none";
  document.getElementById("retakeBtn").style.display = "none";
  document.getElementById("uploadBtn").disabled = true;
  document.getElementById("result").innerText =
    "🔁 Ready to capture a new photo.";
}

// ------------------- UPLOAD -------------------

async function uploadImage() {
  const resultDiv = document.getElementById("result");
  const loadingDiv = document.getElementById("loading");
  const predictionDiv = document.getElementById("predictionResult");

  if (!selectedFile) {
    resultDiv.innerText = "⚠️ Please select or capture an image first!";
    return;
  }

  const formData = new FormData();
  formData.append("image", selectedFile);

  // Show loading spinner
  loadingDiv.style.display = "block";
  resultDiv.innerText = "";
  predictionDiv.style.display = "none";

  try {
    const response = await fetch(`${backendBase}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Server error. Please try again later.");
    }

    const data = await response.json();

    // Hide spinner
    loadingDiv.style.display = "none";

    if (data.message) {
      resultDiv.innerHTML = `<span class="success">✅ ${data.message}</span>`;
      showPrediction(data.disease || "Processing...", data.confidence || 0);

      // Stop camera if active
      if (capturedViaCamera && cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
        cameraActive = false;
        document.getElementById("cameraFeed").srcObject = null;
        document.getElementById("cameraContainer").style.display = "none";
        capturedViaCamera = false;
      }
    } else {
      resultDiv.innerHTML = `<span class="danger">❌ ${
        data.error || "Unexpected error!"
      }</span>`;
    }
  } catch (error) {
    console.error("Upload error:", error);
    loadingDiv.style.display = "none";
    resultDiv.innerHTML =
      '<span class="danger">❌ Error connecting to backend!</span>';
  }
}

// ------------------- PREDICTION DISPLAY -------------------

function showPrediction(disease, confidence) {
  const resultBox = document.getElementById("predictionResult");
  const diseaseText = document.getElementById("diseaseName");
  const confidenceText = document.getElementById("confidenceScore");
  const tipsText = document.getElementById("preventionTips");

  diseaseText.innerText = `🌿 Disease: ${disease}`;
  confidenceText.innerText = `📈 Confidence: ${
    confidence.toFixed ? confidence.toFixed(2) : confidence
  }%`;

  const tips = {
    "Tomato Early Blight": "🪴 Use neem oil and remove infected leaves.",
    "Potato Late Blight":
      "🌦 Avoid water on leaves; apply copper-based fungicide.",
    "Apple Scab": "🍎 Prune infected branches; ensure good air flow.",
    "Corn Rust": "🌽 Rotate crops and use resistant hybrids.",
    "Healthy Leaf": "✅ No issues detected. Maintain regular watering.",
    "Mango Anthracnose": "🥭 Spray with copper fungicide during flowering.",
    "Pepper Bell Bacterial Spot":
      "🌶️ Avoid overhead watering; use disease-free seeds.",
  };

  tipsText.innerText =
    tips[disease] ||
    "💡 Keep monitoring and ensure proper sunlight and water balance.";

  // Apply result color logic
  if (disease.toLowerCase().includes("healthy")) {
    diseaseText.className = "success";
  } else if (confidence < 70) {
    diseaseText.className = "warning";
  } else {
    diseaseText.className = "danger";
  }

  // Smooth fade-in
  resultBox.style.display = "block";
  resultBox.style.animation = "fadeIn 1.2s ease forwards";
}

// ------------------- HISTORY -------------------

async function loadHistory() {
  const historyDiv = document.getElementById("historyTable");
  historyDiv.innerHTML = "<p>⏳ Loading history...</p>";

  try {
    const response = await fetch(`${backendBase}/history`);
    if (!response.ok) throw new Error("Failed to fetch history.");

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

    history.forEach((item) => {
      const colorClass = item.disease.toLowerCase().includes("healthy")
        ? "success"
        : item.confidence < 70
        ? "warning"
        : "danger";

      tableHTML += `
        <tr class="${colorClass}">
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
    console.error("History fetch error:", error);
    historyDiv.innerHTML = "<p>❌ Error loading history!</p>";
  }
}
