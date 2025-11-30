/**
 * BreakComponent displays a relaxation break video to the user for a specified duration.
 * The component manages video loading, playback, and a countdown timer, and marks events for experiment tracking.
 * When the break is completed, it notifies the parent via `onTaskComplete`.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.procedure - Procedure configuration object containing video selection and duration.
 * @param {string} props.sessionId - Unique identifier for the current session.
 * @param {Function} props.onTaskComplete - Callback function invoked when the break is completed.
 *
 * @returns {JSX.Element} The rendered break component UI.
 */

import React, { useState, useEffect, useRef } from 'react';
import './BreakComponent.css';
import { setEventMarker } from '../utils/helpers';

const BreakComponent = ({ procedure, sessionId, onTaskComplete }) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [error, setError] = useState('');
  const [breakCompleted, setBreakCompleted] = useState(false);
  
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const hasStartedRef = useRef(false);

  const getBreakConfig = () => {
    const config = procedure?.configuration?.['media-selection'] || {};
    const duration = procedure?.configuration?.['duration']?.duration || 
                    procedure?.customDuration || 
                    procedure?.duration || 5;
    
    return {
      selectedVideo: config.selectedVideo || 'neutral_1',
      duration: parseInt(duration, 10)
    };
  };

  const { selectedVideo, duration } = getBreakConfig();
  const getVideoFile = (videoId) => {
    const videoMap = {
      'neutral_1': 'Video1.mp4',
      'neutral_2': 'Video2.mp4', 
      'neutral_3': 'Video1.mp4'
    };
    return videoMap[videoId] || videoMap['neutral_1'];
  };

  const getVideoName = (videoId) => {
    const nameMap = {
      'neutral_1': 'Video1.mp4',
      'neutral_2': 'Video2.mp4',
      'neutral_3': 'Video1.mp4'
    };
    return nameMap[videoId] || 'Video1.mp4';
  };

  const videoFile = getVideoFile(selectedVideo);
  const videoName = getVideoName(selectedVideo);
  const videoUrl = `/video_files/${videoFile}`;

  useEffect(() => {
    setTimeRemaining(duration * 60);
  }, [duration]);

  const handleVideoLoad = () => {
    setVideoLoaded(true);
  };

  const handleVideoError = () => {
    setError(`Failed to load video: ${videoFile}. Please contact the experimenter.`);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    
    const handleBreakComplete = async () => {
      if (breakCompleted) return;
      
      setBreakCompleted(true);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      try {
        await setEventMarker('subject_idle');
        
        if (onTaskComplete) {
          await onTaskComplete();
        }
      } catch (error) {
        console.error('Error completing break:', error);
      }
    };
    
    const handleVideoPlay = async () => {
      if (hasStartedRef.current) return;
      
      hasStartedRef.current = true;
      
      try {
        await setEventMarker(`break_${selectedVideo}`);
        
        timerRef.current = setInterval(() => {
          setTimeRemaining(prev => {
            const newTime = prev - 1;
            if (newTime <= 0) {
              clearInterval(timerRef.current);
              if (videoRef.current) {
                videoRef.current.pause();
              }
              handleBreakComplete();
              return 0;
            }
            return newTime;
          });
        }, 1000);
      } catch (error) {
        console.error('Error setting break event marker:', error);
      }
    };
    
    if (video) {
      video.addEventListener('play', handleVideoPlay);
    }
    
    return () => {
      if (video) {
        video.removeEventListener('play', handleVideoPlay);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [selectedVideo, breakCompleted, onTaskComplete]);

  if (breakCompleted) {
    return (
      <div className="break-component">
        <div className="completion-message">
          <div className="completion-icon">✅</div>
          <h2>Break Completed!</h2>
          <p>Please wait for the experimenter to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="break-component">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>Break</h2>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <ul>
            <li>Watch the relaxation video below</li>
            <li>Use the video controls to play, pause, or adjust volume as needed</li>
            <li>The break will end automatically after {duration} minutes</li>
          </ul>
        </div>
    <div className="procedure-meta">
          <div className="video-info">Video: {videoName}</div>
          <div className="timer-display">
            Time Remaining: {formatTime(timeRemaining)}
          </div>
        </div>
        <div className="break-interface">
          {error && (
            <div className="break-error">
              <div className="error-icon">❌</div>
              <h4>Video Loading Error</h4>
              <p>{error}</p>
            </div>
          )}

          {!error && (
            <div className="video-container">
              <video
                ref={videoRef}
                src={videoUrl}
                className="break-video"
                onLoadedData={handleVideoLoad}
                onError={handleVideoError}
                controls={true}
                preload="auto"
                width="640"
                height="360"
              >
                Your browser does not support the video tag.
              </video>
              
              {!videoLoaded && !error && (
                <div className="video-loading">
                  <div className="loading-spinner">⏳</div>
                  <p>Loading video...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="task-status">
        <div className="status-indicator">
          <div className="status-dot active"></div>
          <span>Break video loaded and ready</span>
        </div>
      </div>
    </div>
  );
};

export default BreakComponent;