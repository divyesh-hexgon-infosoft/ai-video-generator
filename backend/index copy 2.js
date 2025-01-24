const express = require('express');
const natural = require('natural');
const { getGeminiClient } = require('./external-api-services/gamini.api');
const { getOpenAIClient } = require('./external-api-services/openai.api');
const tokenizer = new natural.SentenceTokenizer();
const wordTokenizer = new natural.WordTokenizer();

class ScriptWizard {

    constructor() {
        this.optimalSentenceLength = 20;
        this.optimalParagraphLength = 3;
        this.wordsPerMinute = 150;
        // this.scriptGeneretClient = getGeminiClient(); // Get Gemini client instance
        this.scriptGeneretClient = getOpenAIClient(); // Get Gemini client instance
    }

    async generateScript(prompt, options = {}) {
        try {
            const {
                style = 'professional',
                tone = 'friendly',
                duration = '2 minutes',
                format = 'video script'
            } = options;

            // Construct the system prompt
            const systemPrompt = this._constructSystemPrompt(style, tone, duration, format);

            // Use the Gemini client to generate content
            const generatedScript = await this.scriptGeneretClient.generateContent(systemPrompt, prompt);

            // Process the generated script
            const analysis = await this.processScript(generatedScript);

            return {
                originalPrompt: prompt,
                generatedScript,
                analysis
            };
        } catch (error) {
            throw new Error(`Error generating script: ${error.message}`);
        }
    }

    _constructSystemPrompt(style, tone, duration, format) {
        return `You are a professional script writer. Create a ${format} script that is:
        - Written in a ${style} style
        - Uses a ${tone} tone
        - Approximately ${duration} in length
        - Structured for video presentation
        - Clear and engaging
        - Uses natural speaking patterns
        - Includes appropriate pauses and emphasis

        Format the script with:
        - Clear paragraph breaks
        - Natural sentence structure
        - Appropriate pacing
        - Video-friendly language`;
    }

    async processScript(scriptText) {
        try {
            const formattedScript = this.formatScript(scriptText);
            const optimizationResults = this.optimizeScript(formattedScript);
            const timingAnalysis = this.analyzeTimings(formattedScript);

            return {
                formattedScript,
                optimizationResults,
                timingAnalysis
            };
        } catch (error) {
            throw new Error(`Error processing script: ${error.message}`);
        }
    }

    formatScript(scriptText) {
        const paragraphs = scriptText.split(/\n\s*\n/);
        const formattedParagraphs = paragraphs.map(para => {
            return para.trim().replace(/\s+/g, ' ');
        });

        return formattedParagraphs.join('\n\n');
    }

    optimizeScript(scriptText) {
        const sentences = tokenizer.tokenize(scriptText);
        const words = wordTokenizer.tokenize(scriptText);
        const sentenceCount = sentences.length;
        const wordCount = words.length;
        const averageWordsPerSentence = wordCount / sentenceCount;
        const readabilityScore = Math.max(0, Math.min(100, 
            100 - Math.abs(averageWordsPerSentence - this.optimalSentenceLength) * 2
        ));

        return {
            sentenceCount,
            wordCount,
            averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
            readabilityScore: Math.round(readabilityScore)
        };
    }

    analyzeTimings(scriptText) {
        const words = wordTokenizer.tokenize(scriptText);
        const wordCount = words.length;
        const durationInMinutes = wordCount / this.wordsPerMinute;
        const minutes = Math.floor(durationInMinutes);
        const seconds = Math.round((durationInMinutes - minutes) * 60);

        return {
            estimatedDuration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
            wordCount
        };
    }
}

const app = express();
app.use(express.json());

// Initialize ScriptWizard
const wizard = new ScriptWizard();

app.post('/generate-script', async (req, res) => {
    try {
        const { prompt, options } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        const result = await wizard.generateScript(prompt, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/generate-video-script', async (req, res) => {
    try {
        const { prompt } = req.body;
        const options = {
            style: 'professional',
            tone: 'engaging',
            duration: '2 minutes',
            format: 'video script'
        };
        const result = await wizard.generateScript(prompt, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


module.exports = ScriptWizard;

