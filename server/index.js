import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini with your API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    
    // 1. Remove the data header (e.g., "data:image/jpeg;base64,")
    const base64Data = image.split(",")[1];

    // 2. Use gemini-1.5-flash (it's the fastest and free)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = "Analyze this photo as a professional editor. Return ONLY a JSON object with these keys: exposure, contrast, highlights, shadows, vibrance (all numbers -100 to 100) and 'advice' (a short string). No intro text.";

    // 3. Send to Gemini
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // 4. Clean the output (removes any ```json ... ``` blocks)
    const cleanedJson = text.replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(cleanedJson);
    
    console.log("Gemini Success:", aiData);
    res.json(aiData);
    
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Gemini failed to analyze" });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));