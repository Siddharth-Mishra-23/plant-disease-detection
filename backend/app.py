from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sqlite3
import datetime
import numpy as np
import tensorflow as tf
from PIL import Image
import io
import cv2

# ----------------------------------------------------
# FLASK SETUP
# ----------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = 'uploads'
DB_PATH = 'history.db'
MODEL_PATH = 'plant_disease_model_finetuned.h5'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ----------------------------------------------------
# DATABASE INITIALIZATION
# ----------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            disease TEXT,
            confidence REAL,
            timestamp TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# ----------------------------------------------------
# LOAD MODEL SAFELY
# ----------------------------------------------------
model = None
if os.path.exists(MODEL_PATH):
    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        print("✅ Model loaded successfully!")
    except Exception as e:
        print("❌ Error loading model:", e)
else:
    print(f"⚠️ Model file not found at path: {MODEL_PATH}")

# ----------------------------------------------------
# CLASS LABELS (38 classes)
# ----------------------------------------------------
CLASS_NAMES = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy', 'Grape___Black_rot',
    'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot', 'Peach___healthy',
    'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy', 'Potato___Early_blight',
    'Potato___Late_blight', 'Potato___healthy', 'Raspberry___healthy', 'Soybean___healthy',
    'Squash___Powdery_mildew', 'Strawberry___Leaf_scorch', 'Strawberry___healthy',
    'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight', 'Tomato___Leaf_Mold',
    'Tomato___Septoria_leaf_spot', 'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy'
]

# ----------------------------------------------------
# IMAGE PREDICTION FUNCTION
# ----------------------------------------------------
def predict_disease(image_bytes, image_path):
    if model is None:
        print("⚠️ Model not loaded — cannot predict.")
        return "Model Not Loaded", 0.0

    try:
        # ---------- Step 1: Verify leaf (basic green check)
        img_cv = cv2.imread(image_path)
        if img_cv is None:
            print("⚠️ OpenCV could not read image:", image_path)
            return "Invalid Image", 0.0

        hsv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2HSV)
        lower_green = np.array([25, 40, 40])
        upper_green = np.array([90, 255, 255])
        mask = cv2.inRange(hsv, lower_green, upper_green)
        green_ratio = np.sum(mask > 0) / mask.size

        if green_ratio < 0.10:
            print("🟡 Low green ratio:", green_ratio)
            return "Unknown (Not a Leaf Image)", 0.0

        # ---------- Step 2: Model prediction ----------
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.resize((224, 224))
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        preds = model.predict(img_array)
        predicted_idx = np.argmax(preds[0])
        confidence = float(np.max(preds[0]) * 100)
        disease_name = CLASS_NAMES[predicted_idx]

        if confidence < 60:
            disease_name = "Unknown / Low Confidence"

        print(f"✅ Prediction done: {disease_name} ({confidence:.2f}%)")
        return disease_name, round(confidence, 2)

    except Exception as e:
        print("❌ Prediction error:", e)
        return "Error", 0.0

# ----------------------------------------------------
# ROUTES
# ----------------------------------------------------
@app.route('/')
def home():
    return jsonify({"message": "🌿 Plant Disease Detection API is running with Smart AI validation!"})

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded!'}), 400

        image = request.files['image']
        if image.filename == '':
            return jsonify({'error': 'No file selected!'}), 400

        filepath = os.path.join(UPLOAD_FOLDER, image.filename)
        image.save(filepath)

        with open(filepath, "rb") as f:
            image_bytes = f.read()

        disease, confidence = predict_disease(image_bytes, filepath)

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO uploads (filename, disease, confidence, timestamp) VALUES (?, ?, ?, ?)",
            (image.filename, disease, confidence, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.commit()
        conn.close()

        return jsonify({
            "message": "✅ Prediction successful!",
            "filename": image.filename,
            "disease": disease,
            "confidence": confidence
        })

    except Exception as e:
        print("❌ Upload error:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/history', methods=['GET'])
def get_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM uploads ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()

    history = [
        {
            "id": row[0],
            "filename": row[1],
            "disease": row[2],
            "confidence": row[3],
            "timestamp": row[4]
        }
        for row in rows
    ]
    return jsonify({"history": history})

# ----------------------------------------------------
# RUN SERVER
# ----------------------------------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
