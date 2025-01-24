const API_URL = 'http://localhost:3000/api'; // Replace with your actual API endpoint

export const generateVideo = async (videoData) => {
  try {

    const response = await fetch(`${API_URL}/prompt/generate-script-with-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoData), // Sending video data as JSON
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json(); // Parse the JSON response
    return data; // Return the response data

  } catch (error) {
    console.error('Error generating video:', error);
    throw error; // Rethrow the error for further handling
  }


};

