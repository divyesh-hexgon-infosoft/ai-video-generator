const natural = require('natural');
const { Gemini } = require('gemini');
const tokenizer = new natural.SentenceTokenizer();
const wordTokenizer = new natural.WordTokenizer();

class ScriptWizard {
    constructor(geminiApiKey) {
        this.optimalSentenceLength = 20;
        this.optimalParagraphLength = 3;
        this.wordsPerMinute = 150;
        this.gemini = new Gemini({
            apiKey: geminiApiKey
        });
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
            
            // Generate script using Gemini
            const completion = await this.gemini.chat.completions.create({
                model: "gemini-1.0",
                messages: [
                    { 
                        role: "system", 
                        content: systemPrompt 
                    },
                    { 
                        role: "user", 
                        content: prompt 
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            const generatedScript = completion.choices[0].message.content;

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
            // Existing script processing logic
            const formattedScript = await this.formatScript(scriptText);
            const optimizationResults = await this.optimizeScript(formattedScript);
            const timingAnalysis = await this.analyzeTimings(formattedScript);

            return {
                formattedScript,
                optimizationResults,
                timingAnalysis
            };
        } catch (error) {
            throw new Error(`Error processing script: ${error.message}`);
        }
    }

    // ... (rest of the existing ScriptWizard methods remain the same)
}

// Example Express server implementation
const express = require('express');
const app = express();
app.use(express.json());

// Initialize ScriptWizard with your Gemini API key
const wizard = new ScriptWizard(process.env.GEMINI_API_KEY);

// Endpoint for script generation
app.post('/generate-script', async (req, res) => {
    try {
        const { prompt, options } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await wizard.generateScript(prompt, options);
        res.json(result);
    } catch (error) {
        console.log("err : ",error)
        res.status(500).json({ error: error.message });
    }
});

// Add endpoints for specific script types
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = ScriptWizard;