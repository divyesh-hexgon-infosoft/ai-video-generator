const axios = require('axios');

class PexelsClient {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Pexels API key is required.');
        }
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.pexels.com/v1';
    }

    async searchImages(query, options = {}) {
        try {
            const {
                perPage = 10,
                page = 1,
                orientation = 'landscape'
            } = options;

            const response = await axios.get(`${this.baseUrl}/search`, {
                headers: {
                    'Authorization': this.apiKey
                },
                params: {
                    query,
                    per_page: perPage,
                    page: page,
                    orientation: orientation
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`Pexels API error: ${error.message}`);
        }
    }

    async getRandomImage(query) {
        try {
            const images = await this.searchImages(query, { perPage: 1 });
            return images.photos[0] || null;
        } catch (error) {
            throw new Error(`Pexels API error: ${error.message}`);
        }
    }
}

let pexelsClientInstance;

// Singleton pattern to ensure only one instance of PexelsClient
function getPexelsClient() {
    if (!pexelsClientInstance) {
        const apiKey = process.env.PEXELS_API_KEY;
        console.log("api key is", apiKey);
        pexelsClientInstance = new PexelsClient(apiKey);
    }
    return pexelsClientInstance;
}


module.exports = {
    getPexelsClient
};

