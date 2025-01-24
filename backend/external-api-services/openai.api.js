const { OpenAI } = require('openai');

class OpenAIClient {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required.');
        }
        this.openai = new OpenAI({
            apiKey: apiKey
        });
    }

    async generateContent(systemPrompt, userPrompt) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return completion.choices[0].message.content;
        } catch (error) {
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }
}

let openAIClientInstance;

// Singleton pattern to ensure only one instance of OpenAIClient
function getOpenAIClient() {
    if (!openAIClientInstance) {
        const apiKey = process.env.OPENAI_API_KEY;
        openAIClientInstance = new OpenAIClient(apiKey);
    }
    return openAIClientInstance;
}


module.exports = {
    getOpenAIClient
};

