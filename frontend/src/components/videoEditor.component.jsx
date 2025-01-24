'use client'

import React, { useState, useRef, useEffect } from 'react';

const VideoEditor = ({ videoClips }) => {
  const [currentClip, setCurrentClip] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const timelineRef = useRef(null);

  // Load or play/pause the current clip whenever currentClip or isPlaying changes
  useEffect(() => {
    if (!videoRef.current || videoClips.length === 0) return;

    videoRef.current.src = videoClips[currentClip].path;
    if (isPlaying) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [currentClip, isPlaying, videoClips]);

  // Update progress state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      const current = video.currentTime;
      const duration = video.duration || 1; // avoid dividing by 0
      setProgress((current / duration) * 100);
    };

    video.addEventListener('timeupdate', updateProgress);
    return () => {
      video.removeEventListener('timeupdate', updateProgress);
    };
  }, []);

  // Play/pause handler
  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Advance to the next clip (with wrap-around)
  const handleNextClip = () => {
    setCurrentClip((prev) => (prev + 1) % videoClips.length);
  };

  // Go to the previous clip (with wrap-around)
  const handlePrevClip = () => {
    setCurrentClip((prev) => (prev - 1 + videoClips.length) % videoClips.length);
  };

  // When a clip ends, move to next or pause if last
  const handleVideoEnd = () => {
    if (currentClip < videoClips.length - 1) {
      // Not the last clip, go to the next
      handleNextClip();
    } else {
      // Last clip ended, pause
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Jump through timeline (click on progress bar)
  const handleTimelineClick = (e) => {
    if (!videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = (x / rect.width) * 100;
    videoRef.current.currentTime = (clickedProgress / 100) * videoRef.current.duration;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-teal-800 text-white p-8">
      <h1 className="text-5xl font-extrabold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
        Cinematic Video Editor
      </h1>
      <div className="max-w-6xl mx-auto bg-black bg-opacity-50 rounded-3xl p-8 shadow-2xl">
        <div className="mb-8 rounded-2xl overflow-hidden shadow-lg relative">
          <video
            ref={videoRef}
            className="w-full h-auto"
            onEnded={handleVideoEnd}
          >
            Your browser does not support the video tag.
          </video>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
            <div 
              ref={timelineRef}
              className="h-2 bg-gray-700 rounded-full cursor-pointer"
              onClick={handleTimelineClick}
            >
              <div 
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-center space-x-4 mb-8">
          <button
            onClick={handlePrevClip}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105"
          >
            Previous
          </button>
          <button
            onClick={handlePlayPause}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={handleNextClip}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105"
          >
            Next
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {videoClips.map((clip, index) => (
            <div
              key={index}
              className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-300 transform hover:scale-105 ${
                index === currentClip ? 'ring-4 ring-teal-500' : ''
              }`}
              onClick={() => setCurrentClip(index)}
            >
              <video
                className="w-full h-auto"
                src={clip.path}
                muted
                loop
                playsInline
                onMouseEnter={(e) => e.target.play()}
                onMouseLeave={(e) => e.target.pause()}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs py-1 px-2">
                {clip.duration.toFixed(2)}s
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
