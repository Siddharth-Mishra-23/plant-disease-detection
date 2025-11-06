from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sqlite3
from datetime import datetime
import random

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = 'uploads'
DB_PATH = 'history.db'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ---------------- DATABASE SETUP ----------------
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

# ---------------- MOCK PREDICTION ----------------
def predict_disease_mock(filename):
    diseases = [
        ("Tomato Early Blight", 92.3),
        ("Potato Late Blight", 87.6),
        ("Apple Scab", 95.2),
        ("Corn Rust", 91.8),
        ("Healthy Leaf", 99.0),
        ("Mango Anthracnose", 88.7),
        ("Pepper Bell Bacterial Spot", 90.4)
    ]
    return random.choice(diseases)

# ---------------- ROUTES ----------------

@app.route('/')
def home():
    return jsonify({"message": "Plant Disease Detection API is running!"})

@app.route('/upload', methods=['POST'])
def upload_image():
    image = request.files.get('image')
    if image:
        filename = image.filename
        image_path = os.path.join(UPLOAD_FOLDER, filename)
        image.save(image_path)

        # Mock prediction for now
        disease, confidence = predict_disease_mock(filename)

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Save result to SQLite
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO uploads (filename, disease, confidence, timestamp) VALUES (?, ?, ?, ?)",
            (filename, disease, confidence, timestamp)
        )
        conn.commit()
        conn.close()

        return jsonify({
            'message': 'Image uploaded successfully!',
            'disease': disease,
            'confidence': confidence
        })
    else:
        return jsonify({'error': 'No image received!'}), 400

@app.route('/history', methods=['GET'])
def get_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM uploads ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()

    history = []
    for row in rows:
        history.append({
            "id": row[0],
            "filename": row[1],
            "disease": row[2],
            "confidence": row[3],
            "timestamp": row[4]
        })
    return jsonify({"history": history})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
