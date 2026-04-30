import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();
async function list() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // There isn't a direct listModels in the high-level SDK, 
        // but we can try to fetch a specific one to test.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Testing gemini-1.5-flash...");
        const result = await model.generateContent("test");
        console.log("Success!");
    }
    catch (e) {
        console.error("Failed:", e.message);
    }
}
list();
