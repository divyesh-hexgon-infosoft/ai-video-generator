import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { generateVideo } from '../services/video-generate.service';
import VideoEditor from './videoEditor.component';

const VideoGeneratorApp = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [tone, setTone] = useState('');
  const [duration, setDuration] = useState('');
  const [numberOfScenes, setNumberOfScenes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoResult, setVideoResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const videoData = { 
        prompt,
        options: {
            style, tone, duration, numberOfScenes
        }
    };

    try {
      const result = await generateVideo(videoData);
      console.log('Video generated successfully:', result);
      setVideoResult(result.videoScenePath);
      console.log('Video path:', result.videoScenePath);
    } catch (error) {
      console.error('Error generating video:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setVideoResult(null);
    setPrompt('');
    setStyle('');
    setTone('');
    setDuration('');
    setNumberOfScenes('');
  };

  const styleOptions = ['Professional','Casual','Storytelling','Inspirational','Educational','Cinematic','Documentary'];
  const toneOptions = ['Friendly','Serious','Optimistic','Persuasive','Authoritative'];
  const durationOptions = ['15 seconds', '30 seconds', '1 minute', '2 minutes'];
  const numberOfScenesOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  if (videoResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleReset}
          className="mb-6 px-4 py-2 bg-white bg-opacity-20 backdrop-filter backdrop-blur-lg rounded-lg text-white hover:bg-opacity-30 transition duration-300"
        >
          ← Back to Generator
        </motion.button>
        <VideoEditor videoClips={videoResult} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center px-2 sm:px-4 lg:px-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full space-y-8 bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg p-10 rounded-2xl shadow-2xl"
      >
        <div>
          <motion.h1
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-5xl font-extrabold text-center text-white mb-2"
          >
            AI Video Creator
          </motion.h1>
          <p className="text-center text-gray-200">
            Transform your ideas into stunning videos
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="prompt" className="sr-only">Enter your prompt</label>
              <textarea
                id="prompt"
                name="prompt"
                required
                className="w-full appearance-none rounded-lg relative block px-3 py-2  border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-300 ease-in-out"
                placeholder="Describe your video idea..."
                rows="4"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Style', options: styleOptions, value: style, setValue: setStyle },
              { label: 'Tone', options: toneOptions, value: tone, setValue: setTone },
              { label: 'Duration', options: durationOptions, value: duration, setValue: setDuration },
              { label: 'Scenes', options: numberOfScenesOptions, value: numberOfScenes, setValue: setNumberOfScenes },
            ].map((field) => (
              <div key={field.label} className="relative">
                <label htmlFor={field.label.toLowerCase()} className="block text-sm font-medium text-gray-200 mb-1">
                  {field.label}
                </label>
                <select
                  id={field.label.toLowerCase()}
                  name={field.label.toLowerCase()}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg bg-white bg-opacity-20 backdrop-filter backdrop-blur-lg text-white appearance-none transition duration-300 ease-in-out"
                  value={field.value}
                  onChange={(e) => field.setValue(e.target.value)}
                  required
                >
                  <option value="" className="text-gray-900">Select {field.label.toLowerCase()}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option} className="text-gray-900">
                      {option}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 pt-6 text-white">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
          <div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300 ease-in-out"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              ) : (
                "Generate Video"
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default VideoGeneratorApp;
