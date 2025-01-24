const natural = require('natural');
const { getGeminiClient } = require('../external-api-services/gamini.api');
const { getOpenAIClient } = require('../external-api-services/openai.api');
const tokenizer = new natural.SentenceTokenizer();
const wordTokenizer = new natural.WordTokenizer();

class ScriptWizard {
    constructor() {
        this.optimalSentenceLength = 20;
        this.optimalParagraphLength = 3;
        this.wordsPerMinute = 150;
        // this.scriptGeneretClient = getGeminiClient();
        this.scriptGeneretClient = getOpenAIClient();
    }

    async generateScript(prompt, options = {}) {
        try {
            const {
                style = 'professional',
                tone = 'friendly',
                duration = '2 minutes',
                format = 'video script',
                numberOfScenes = 3
            } = options;

            // Enhanced system prompt for better visual descriptions
            const systemPrompt = this._constructSystemPrompt(style, tone, duration, format, numberOfScenes);
            const generatedScript = await this.scriptGeneretClient.generateContent(systemPrompt, prompt);
            
            // Generate detailed search keywords for each scene
            const scenes = await this.parseScenes(generatedScript);
            const scenesWithKeywords = await this._enhanceSceneKeywords(scenes);
            
            const analysis = await this.processScript(generatedScript);

            return {
                originalPrompt: prompt,
                generatedScript,
                scenes: scenesWithKeywords,
                analysis
            }
        } catch (error) {
            throw new Error(`Error generating script: ${error.message}`);
        }
    }


    _constructSystemPrompt(style, tone, duration, format, numberOfScenes) {
        return `You are a professional script writer. Create a ${format} script that is:
        - Written in a ${style} style
        - Uses a ${tone} tone
        - Approximately ${duration} in length
        - Divided into exactly ${numberOfScenes} distinct scenes
        - Structured for video presentation
        
        For each scene, provide:
        1. A DETAILED visual description in [brackets] that includes:
           - Specific setting details
           - Lighting conditions
           - Camera angles or shot types
           - Key visual elements
           - Actions or movements
           - Important objects or subjects
        
        2. Specify "MEDIA_TYPE:" followed by either:
           - "video" for scenes with movement or action
           - "image" for static scenes
        
        3. Include [KEYWORDS] section with 5-7 specific search terms that describe:
           - Main subject
           - Setting
           - Style/mood
           - Actions
           - Visual characteristics
        
        Example format:
        **Scene 1:**
        [Modern corporate office interior, warm natural lighting through large windows, wide establishing shot, business professionals in formal attire working at sleek desks with dual monitors, subtle activity with people walking in background]
        MEDIA_TYPE: video
        [KEYWORDS]: corporate office interior, natural lighting, business professionals working, modern workspace, wide office shot, professional environment
        Narrator (enthusiastic): Script text here...
        [Pause]`;
    }

    async _enhanceSceneKeywords(scenes) {
        const enhancedScenes = [];
        
        for (const scene of scenes) {
            try {
                // Generate enhanced search keywords using AI
                const keywordPrompt = `
                Generate specific, visually-focused search keywords for this scene description. 
                Include different variations and related terms that would help find matching video/image content.
                Scene: ${scene.visualDescription}
                Consider:
                - Main subjects/objects
                - Actions/movements
                - Setting/environment
                - Visual style/mood
                - Lighting/time of day
                - Camera angles/shots
                Return only keywords, separated by commas.`;

                const keywordResponse = await this.scriptGeneretClient.generateContent(null, keywordPrompt);
                const enhancedKeywords = keywordResponse
                    .split(',')
                    .map(k => k.trim())
                    .filter(k => k.length > 0);

                enhancedScenes.push({
                    ...scene,
                    searchKeywords: enhancedKeywords,
                    searchQueries: this._generateSearchQueries(enhancedKeywords, scene.visualDescription)
                });
            } catch (error) {
                console.warn(`Error enhancing keywords for scene ${scene.sceneNumber}:`, error);
                enhancedScenes.push(scene);
            }
        }
        
        return enhancedScenes;
    }

    _generateSearchQueries(keywords, description) {
        // Generate multiple search query variations
        const queries = new Set();

        // Add the full description as a query
        queries.add(description);

        // Add individual keywords
        keywords.forEach(keyword => queries.add(keyword));

        // Generate 2-word combinations
        for (let i = 0; i < keywords.length - 1; i++) {
            for (let j = i + 1; j < keywords.length; j++) {
                queries.add(`${keywords[i]} ${keywords[j]}`);
            }
        }
        
        return Array.from(queries);
    }

    parseScenes(scriptText) {
        const sceneRegex = /\*\*Scene \d+:\*\*\s*\[(.*?)\]\s*MEDIA_TYPE:\s*(video|image)([\s\S]*?)(?=\*\*Scene \d+:\*\*|$)/g;
        const scenes = [];
        let match;

        while ((match = sceneRegex.exec(scriptText)) !== null) {
            const visualDescription = match[1].trim();
            const mediaType = match[2].trim();
            const sceneContent = match[3];

            // Clean the scene text
            const cleanText = this._cleanSceneText(sceneContent);

            // Only add non-empty scenes
            if (cleanText) {
                scenes.push({
                    sceneNumber: scenes.length + 1,
                    text: cleanText,
                    duration: this.analyzeTimings(cleanText),
                    visualDescription: visualDescription,
                    mediaType: mediaType,
                    searchKeywords: this._extractSearchKeywords(visualDescription)
                });
            }
        }

        return scenes;
    }

    _extractSearchKeywords(visualDescription) {
        const words = visualDescription.toLowerCase().split(/\s+/);
        const stopWords = new Set(['a', 'an', 'the', 'with', 'at', 'of', 'in', 'on', 'for']);
        return words
            .filter(word => !stopWords.has(word))
            .map(word => word.replace(/[^\w\s]/g, ''))
            .filter(word => word.length > 2)
            .slice(0, 3);
    }

    _cleanSceneText(sceneContent) {
        return sceneContent
            .replace(/\[.*?\]/g, '')                    // Remove bracketed descriptions
            .replace(/Narrator\s*\([^)]*\):/g, '')      // Remove "Narrator (tone):"
            .replace(/Narrator:/g, '')                  // Remove "Narrator:"
            .replace(/\[Pause\]/g, '')                  // Remove [Pause]
            .replace(/^\s*\*\s/gm, '')                 // Remove bullet points
            .replace(/\s+/g, ' ')                      // Normalize whitespace
            .trim();
    }

    async processScript(scriptText) {
        try {
            
            const formattedScript = this.formatScript(scriptText);
            const optimizationResults = this.optimizeScript(formattedScript);
            const timingAnalysis = this.analyzeTimings(formattedScript);
            const scenes = this.parseScenes(formattedScript);

            return {
                formattedScript,
                optimizationResults,
                timingAnalysis,
                numberOfScenes: scenes.length,
                sceneSummary: scenes.map(scene => ({
                    sceneNumber: scene.sceneNumber,
                    duration: scene.duration,
                    visualDescription: scene.visualDescription,
                    mediaType: scene.mediaType,
                    searchKeywords: scene.searchKeywords
                }))
            };
        } catch (error) {
            throw new Error(`Error processing script: ${error.message}`);
        }
    }

    formatScript(scriptText) {
        return scriptText
            .replace(/\n{3,}/g, '\n\n')                  // Normalize multiple line breaks
            .replace(/([^\n])\*\*Scene/g, '$1\n\n**Scene')  // Ensure scene markers start on new lines
            .trim();
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

module.exports = new ScriptWizard();
