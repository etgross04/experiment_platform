/**
 * MainTaskComponent
 * 
 * This React component manages the automated sequence for a "Room Observation Task" procedure.
 * It handles audio playback, timed observation, automatic recording, and phase transitions for the main task.
 * The component supports both experimenter and subject modes, with experimenter mode providing more granular controls.
 * 
 * Props:
 * @param {string} questionSet - The question set to use ('main_task_1', 'main_task_2', 'main_task_3'). Defaults to 'main_task_1'.
 * @param {Object} procedure - The procedure configuration object containing condition markers and wizard data.
 * @param {string} sessionId - The current session identifier.
 * @param {Function} onTaskComplete - Callback function invoked when the task is completed.
 * @param {boolean} isExperimenterMode - If true, renders experimenter controls and audio players. Defaults to false.
 * 
 * State:
 * - currentPhase: Tracks the current phase of the task ('intro', 'observation', 'instructions', 'question1', 'question2', 'wait', 'completed').
 * - isRecording: Indicates if audio recording is in progress.
 * - recordingStatus: Status message for recording and phase transitions.
 * - observationTimeLeft: Countdown timer for the observation phase.
 * - eventMarker: Marker for the current event, used for recording and logging.
 * - condition: Condition marker for the current task, used for logging and recording.
 * 
 * Features:
 * - Automated audio playback for each phase.
 * - Timed observation and question response periods.
 * - Automatic start/stop of audio recording with beeps for notifications.
 * - Experimenter mode with manual audio controls.
 * - Cleanup of timers and intervals on component unmount.
 * 
 * Usage:
 * <MainTaskComponent
 *   questionSet="main_task_1"
 *   procedure={procedureObject}
 *   sessionId="abc123"
 *   onTaskComplete={handleComplete}
 *   isExperimenterMode={true}
 * />
 */

import React, { useState, useEffect, useRef } from 'react';
import { recordTaskAudio, startRecording, playBeep, setCondition, setEventMarker } from '../utils/helpers.js';
import './MainTaskComponent.css';

const MainTaskComponent = ({ 
  questionSet = 'main_task_1',
  procedure, 
  sessionId, 
  onTaskComplete, 
  isExperimenterMode = false 
}) => {
  const validQuestionSets = ['main_task_1', 'main_task_2', 'main_task_3'];
  const selectedQuestionSet = validQuestionSets.includes(questionSet) ? questionSet : 'main_task_1';
  
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('intro'); 
  const [recordingStatus, setRecordingStatus] = useState('');
  const [observationTimeLeft, setObservationTimeLeft] = useState(60);
  const [eventMarker, setEventMarkerState] = useState('');
  const [condition, setConditionState] = useState('None');

  const introAudioRef = useRef(null);
  const instructionsAudioRef = useRef(null);
  const question1AudioRef = useRef(null);
  const question2AudioRef = useRef(null);
  const waitAudioRef = useRef(null);
  const observationTimerRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  
  const AUDIO_DIR = `/audio_files/main_task_audio/${selectedQuestionSet}/`;

  useEffect(() => {
    let taskCondition = 'main_task';
    
    if (procedure?.configuration?.['question-set']?.conditionMarker) {
      taskCondition = procedure.configuration['question-set'].conditionMarker;
    } else if (procedure?.wizardData?.rawConfiguration?.['question-set']?.conditionMarker) {
      taskCondition = procedure.wizardData.rawConfiguration['question-set'].conditionMarker;
    }
    
    const taskEventMarker = 'main_task';
    
    setEventMarkerState(taskEventMarker);
    setConditionState(taskCondition);
    setEventMarker(taskEventMarker);
    setCondition(taskCondition);
    
    console.log('MainTask initialized with condition:', taskCondition, 'event marker:', taskEventMarker, 'question set:', selectedQuestionSet);
  }, [procedure, selectedQuestionSet]);

  const handleIntroEnd = () => {
    console.log("Intro finished, starting 60-second observation period...");
    setCurrentPhase('observation');
    setRecordingStatus('60 second observation timer started...');
    
    // Start 60-second countdown
    observationTimerRef.current = setInterval(() => {
      setObservationTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(observationTimerRef.current);
          console.log("Observation complete, auto-playing instructions...");
          setCurrentPhase('instructions');
          // Auto-play instructions after a short delay
          setRecordingStatus(' ');
          setTimeout(() => {
            if (instructionsAudioRef.current) {
              instructionsAudioRef.current.load();
              instructionsAudioRef.current.play().catch(console.error);
            }
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleInstructionsEnd = () => {
    console.log("Instructions finished, auto-playing Question 1...");
    setCurrentPhase('question1');
    // Auto-play Q1 after a short delay
    setTimeout(() => {
      if (question1AudioRef.current) {
        question1AudioRef.current.load();
        question1AudioRef.current.play().catch(console.error);
      }
    }, 500);
  };

  const handleQuestion1End = () => {
    console.log("Question 1 finished, starting recording...");
    startRecordingForQuestion('question1');
  };

  const handleQuestion2End = () => {
    console.log("Question 2 finished, starting recording...");
    startRecordingForQuestion('question2');
  };

  const startRecordingForQuestion = (questionType) => {
    setIsRecording(true);
    setRecordingStatus(`Recording started for ${questionType}... 90 second timer started.`);
    
    try {
      const emarker = `${eventMarker}_${questionType}`;
      setEventMarker(emarker);
      startRecording();
      playBeep(); 
      
      console.log(`Recording started for ${questionType}`);

      // 15-second warning beeps (at 75 seconds)
      beepTimeoutRef.current = setTimeout(() => {
        playBeep();
        setTimeout(playBeep, 500); 
      }, 75000);

      // Stop recording after 90 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecordingForQuestion(questionType);
      }, 90000);
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingStatus(`Recording failed: ${error.message}`);
    }
  };

  const stopRecordingForQuestion = (questionType) => {
    setIsRecording(false);
    console.log(`Stopping recording for ${questionType}`);
    
    recordTaskAudio(eventMarker, condition, 'stop', questionType, (message) => {
      setRecordingStatus(message);
    });
    
    setRecordingStatus("Recording stopped.");
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
    }
    
    // Move to next phase and auto-play
    if (questionType === 'question1') {
      console.log("Recording 1 complete, auto-playing Question 2...");
      setCurrentPhase('question2');
      setTimeout(() => {
        if (question2AudioRef.current) {
          question2AudioRef.current.load();
          question2AudioRef.current.play().catch(console.error);
        }
      }, 500);
    } else if (questionType === 'question2') {
      console.log("Recording 2 complete, auto-playing wait instructions...");
      setCurrentPhase('wait');
      setTimeout(() => {
        if (waitAudioRef.current) {
          waitAudioRef.current.load();
          waitAudioRef.current.play().catch(console.error);
        }
      }, 500);
    }
  };

  const handleWaitInstructionsEnd = async () => {
    console.log("Wait for instructions completed, auto-completing task");
    setCurrentPhase('completed');
    setEventMarker('subject_idle');
    setCondition('None');
    
    if (onTaskComplete) {
      try {
        await onTaskComplete();
        console.log("Main task auto-completed successfully");
      } catch (error) {
        console.error("Error auto-completing main task:", error);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (observationTimerRef.current) {
        clearInterval(observationTimerRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current);
      }
    };
  }, []);

  if (isExperimenterMode) {
    return (
      <div className="main-task-experimenter-control">
        <audio 
          ref={introAudioRef}
          onEnded={handleIntroEnd}
          style={{ display: 'none' }}
        >
          <source src={`${AUDIO_DIR}1-Task1-Intro.mp3`} type="audio/mpeg" />
        </audio>
        
        <audio 
          ref={instructionsAudioRef}
          onEnded={handleInstructionsEnd}
          style={{ display: 'none' }}
        >
          <source src={`${AUDIO_DIR}2-Task1-PostObservation.mp3`} type="audio/mpeg" />
        </audio>
        
        <audio 
          ref={question1AudioRef}
          onEnded={handleQuestion1End}
          style={{ display: 'none' }}
        >
          <source src={`${AUDIO_DIR}3-Task1-Q1.mp3`} type="audio/mpeg" />
        </audio>
        
        <audio 
          ref={question2AudioRef}
          onEnded={handleQuestion2End}
          style={{ display: 'none' }}
        >
          <source src={`${AUDIO_DIR}4-Task1-Q2.mp3`} type="audio/mpeg" />
        </audio>
        
        <audio 
          ref={waitAudioRef}
          onEnded={handleWaitInstructionsEnd}
          style={{ display: 'none' }}
        >
          <source src={`${AUDIO_DIR}Wait_For_Instructions.mp3`} type="audio/mpeg" />
        </audio>

        <div className="main-task-status">
          <div className={`status-indicator ${isRecording ? 'recording' : ''}`}>
            <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
            <span>
              {isRecording ? 'Recording...' : 
               currentPhase === 'completed' ? 'Completed' : 
               currentPhase === 'wait' ? 'Final instructions' :
               currentPhase === 'observation' ? `Observing (${observationTimeLeft}s)` :
               currentPhase === 'question1' ? 'Question 1' :
               currentPhase === 'question2' ? 'Question 2' :
               currentPhase === 'instructions' ? 'Instructions' :
               'Introduction'}
            </span>
          </div>
        </div>

        <div className="main-task-controls">
          {currentPhase === 'intro' && (
            <div className="intro-control">
              <label>Introduction Audio:</label>
              <audio 
                ref={introAudioRef}
                controls
                onEnded={handleIntroEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}1-Task1-Intro.mp3`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'observation' && (
            <div className="observation-control">
              <label>Observation Period:</label>
              <div className="observation-timer-display">
                <div className="timer-count">
                  {observationTimeLeft}s
                </div>
                <div className="timer-text">
                  Observation time remaining
                </div>
              </div>
            </div>
          )}

          {currentPhase === 'instructions' && (
            <div className="instructions-control">
              <label>Instructions:</label>
              <audio 
                ref={instructionsAudioRef}
                controls
                onEnded={handleInstructionsEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}2-Task1-PostObservation.mp3`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'question1' && (
            <div className="question-control">
              <label>Question 1:</label>
              <audio 
                ref={question1AudioRef}
                controls
                onEnded={handleQuestion1End}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}3-Task1-Q1.mp3`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'question2' && (
            <div className="question-control">
              <label>Question 2:</label>
              <audio 
                ref={question2AudioRef}
                controls
                onEnded={handleQuestion2End}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}4-Task1-Q2.mp3`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'wait' && (
            <div className="wait-control">
              <label>Final Instructions:</label>
              <audio 
                ref={waitAudioRef}
                controls
                onEnded={handleWaitInstructionsEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}Wait_For_Instructions.mp3`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'completed' && (
            <div className="completion-control">
              <label>Task Completed</label>
              <div className="completion-display">
                Main task automation sequence completed successfully.
              </div>
            </div>
          )}
        </div>

        {recordingStatus && (
          <div className="recording-status" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {recordingStatus}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="main-task-component">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>Room Observation Task</h2>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <ul>
            <li>Ensure the subject is fitted with their microphone, airpods or headphones.</li>
            <li>When they are ready, press play on the introduction audio player.</li>
            <li>Each section is timed and will pause for responses automatically.</li>
            <li>Recording will also start and stop automatically.</li>
            <li>The subject will hear a "beep" to indicate that recording has started</li>
            <li>They will hear a short series of beeps 15 seconds before the time for each question is up.</li>
            <li>When the last notification indicates recording has stopped, the subject has finished the task.</li>
          </ul>
        </div>

        <div className="task-interface">
          {currentPhase === 'intro' && (
            <div className="intro-section">
              <h3>Introduction</h3>
              <div className="audio-container">
                <audio 
                  controls
                  onEnded={handleIntroEnd}
                >
                  <source src={`${AUDIO_DIR}1-Task1-Intro.mp3`} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}

          {currentPhase === 'observation' && (
            <div className="observation-section">
              <h3>Observation Period</h3>
              <div className="observation-timer">
                <div className="timer-display">
                  {observationTimeLeft}
                </div>
                <div className="timer-label">seconds remaining</div>
              </div>
              <div className="recording-status">
                {recordingStatus}
              </div>
            </div>
          )}

          {currentPhase === 'instructions' && (
            <div className="instructions-section">
              <h3>Instructions (Playing Automatically)</h3>
              <div className="auto-play-indicator">
                <p>Playing: 2-Task1-PostObservation.mp3</p>
              </div>
            </div>
          )}

          {(currentPhase === 'question1' || currentPhase === 'question2') && (
            <div className="question-section">
              <h3>{currentPhase === 'question1' ? 'Question 1 (Playing Automatically)' : 'Question 2 (Playing Automatically)'}</h3>
              <div className="auto-play-indicator">
                <p>Playing: {currentPhase === 'question1' ? '3-Task1-Q1.mp3' : '4-Task1-Q2.mp3'}</p>
                <div className="recording-status">
                  {recordingStatus}
                </div>
              </div>
            </div>
          )}

          {currentPhase === 'wait' && (
            <div className="wait-instructions">
              <h3>Final Instructions (Playing Automatically)</h3>
              <div className="auto-play-indicator">
                <p>Playing: Wait_For_Instructions.mp3</p>
              </div>
            </div>
          )}

          {currentPhase === 'completed' && (
            <div className="completion-message">
              <h3>Room Observation Task Completed</h3>
              <p>Thank you for completing the room observation task.</p>
              <p>All audio segments have been recorded successfully.</p>
            </div>
          )}
        </div>
      </div>

      <div className="task-status">
        <div className="status-indicator">
          <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
          <span>
            {isRecording ? 'Recording in progress...' : 
             currentPhase === 'completed' ? 'Task completed' : 
             currentPhase === 'wait' ? 'Playing final instructions' :
             currentPhase === 'observation' ? `Observation period (${observationTimeLeft}s remaining)` :
             currentPhase === 'question1' ? 'Question 1' :
             currentPhase === 'question2' ? 'Question 2' :
             currentPhase === 'instructions' ? 'Playing instructions' :
             'Listen to introduction'}
          </span>
        </div>
        <div className="progress-info">
          Phase: {currentPhase}
        </div>
      </div>
    </div>
  );
};

export default MainTaskComponent;