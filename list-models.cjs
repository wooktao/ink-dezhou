const https = require('https');
require('dotenv').config();

const key = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    try {
      const json = JSON.parse(data);
      if (json.models) {
        console.log("Available models:");
        json.models.forEach(m => console.log(" - " + m.name));
      } else {
        console.log("No models field in response:", data);
      }
    } catch (e) {
      console.log("Error parsing JSON:", data);
    }
  });
}).on('error', (err) => {
  console.error("Error:", err.message);
});
