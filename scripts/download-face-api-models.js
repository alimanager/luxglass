import fs from 'fs';
import path from 'path';
import https from 'https';

const MODELS_DIR = 'public/models/face-api';
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

// Create models directory if it doesn't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

// Download each model file
MODELS.forEach(model => {
  const url = `${BASE_URL}/${model}`;
  const filePath = path.join(MODELS_DIR, model);

  https.get(url, (response) => {
    const fileStream = fs.createWriteStream(filePath);
    response.pipe(fileStream);

    fileStream.on('finish', () => {
      console.log(`Downloaded: ${model}`);
      fileStream.close();
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${model}:`, err.message);
  });
});