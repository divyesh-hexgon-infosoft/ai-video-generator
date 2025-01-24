const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiClient {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Gemini API key is required.');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async generateContent(systemPrompt, userPrompt) {
        try {
            // Initialize Gemini model
            const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

            // Generate content using the prompts
            const result = await model.generateContent([
                { text: systemPrompt },
                { text: userPrompt }
            ]);

            return result.response.text();
        } catch (error) {
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }
}

let geminiClientInstance;

// Singleton pattern to ensure only one instance of GeminiClient
function getGeminiClient() {
    if (!geminiClientInstance) {
        const apiKey = process.env.GEMINI_API_KEY;
        geminiClientInstance = new GeminiClient(apiKey);
    }
    return geminiClientInstance;
}


module.exports = {
    getGeminiClient
};
