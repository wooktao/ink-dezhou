const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function list() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("No API KEY found in .env");
    return;
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Using v1beta explicitly through the raw fetch if necessary, 
  // but let's try the SDK first with a different model string.
  const models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
  
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      console.log(`Testing ${m}...`);
      const result = await model.generateContent("hi");
      console.log(`  Success for ${m}!`);
      return;
    } catch (e) {
      console.error(`  Failed for ${m}: ${e.message}`);
    }
  }
}
list();
