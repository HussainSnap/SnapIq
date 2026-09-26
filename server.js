const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Keys loading
const apiKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
].filter(Boolean);

let currentKeyIndex = 0;

app.post('/api/analyze', async (req, res) => {
    const { base64Data, lang, detail } = req.body;

    if (!base64Data) {
        return res.status(400).json({ error: 'No image data provided' });
    }

    if (apiKeys.length === 0) {
        console.error("❌ No API Keys found in .env file!");
        return res.status(500).json({ error: 'No Groq API keys found in .env file.' });
    }

    let langInstruction = "English";
    if (lang === "ru") langInstruction = "casual Roman Urdu (like daily WhatsApp chat)";
    if (lang === "rh") langInstruction = "Roman Hindi";

    let detailInstruction = "Provide standard balanced answers.";
    let maxTokens = 600;
    if (detail === "short") {
        detailInstruction = "Keep answers concise (1-2 lines).";
        maxTokens = 300;
    } else if (detail === "detailed") {
        detailInstruction = "Provide comprehensive answers.";
        maxTokens = 1200;
    }

    const promptText = `Analyze this image carefully. Response language must be: ${langInstruction}. Detail level: ${detailInstruction}.
Return ONLY a valid raw JSON object (no markdown, no backticks, no markdown code blocks) with these exact keys:
{
  "name": "Name of object",
  "purpose": "Main purpose",
  "features": "Key features",
  "value": "Value and importance",
  "usage": "Common usage",
  "details": "Extra details"
}`;

    let attempts = 0;
    let success = false;
    let parsedData = null;
    let lastError = "";

    while (attempts < apiKeys.length && !success) {
        const currentApiKey = apiKeys[currentKeyIndex];
        const groq = new Groq({ apiKey: currentApiKey });

        try {
            console.log(`🔍 Trying Groq Key #${currentKeyIndex + 1}...`);

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: promptText },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
                        ]
                    }
                ],
                model: "qwen/qwen3.8-27b",
                response_format: { type: "json_object" },
                max_tokens: maxTokens
            });

            let rawContent = chatCompletion.choices[0].message.content || "";
            
            // Clean markdown formatting if present
            rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

            parsedData = JSON.parse(rawContent);
            success = true;
            
            // Move key index for next request (Round-Robin)
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            console.log("✅ Analysis Successful!");

        } catch (error) {
            lastError = error.message;
            console.error(`❌ Key #${currentKeyIndex + 1} Failed:`, error.message);
            
            // Switch key on failure
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            attempts++;
        }
    }

    if (success && parsedData) {
        res.json(parsedData);
    } else {
        res.status(500).json({ error: `Groq Request Failed: ${lastError}` });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`🔑 Total Active API Keys Loaded: ${apiKeys.length}`);
});

// Google Sheet Registration Route
app.post('/api/register-user', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Yahan apna copied Web App URL paste karein
    const googleSheetUrl = "https://script.google.com/macros/s/AKfycbwV6W1GPtCEJHoTumYl_NIzRfNS79Y1X1RFmjkfOgPytzTVb2wzafGcoRx6-69QftYT6w/exec";

    try {
        if (googleSheetUrl && googleSheetUrl.startsWith("http")) {
            await fetch(googleSheetUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            console.log(`👤 New User Registered: ${name}`);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Google Sheet Error:", err.message);
        res.json({ success: true });
    }
});