
/**
 * PRSComponent renders the Perceived Restorativeness Scale (PRS) task interface.
 * It manages audio playback, randomized question order, recording user responses,
 * and transitions between introduction, questions, and final instructions.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {string} [props.questionSet='prs_1'] - The question set to use ('prs_1', 'prs_2', or 'prs_3').
 * @param {Object} props.procedure - Procedure configuration object.
 * @param {number} props.prsSequenceNumber - Sequence number for the PRS event marker.
 * @param {string} props.sessionId - Session identifier for the experiment.
 * @param {Function} props.onTaskComplete - Callback invoked when the PRS task is completed.
 * @param {boolean} [props.isExperimenterMode=false] - If true, renders experimenter controls.
 *
 * @returns {JSX.Element} The rendered PRS task component.
 *
 * @example
 * <PRSComponent
 *   questionSet="prs_2"
 *   procedure={procedureConfig}
 *   prsSequenceNumber={2}
 *   sessionId="abc123"
 *   onTaskComplete={handleComplete}
 *   isExperimenterMode={true}
 * />
 */

import React, { useState, useEffect, useRef } from 'react';
import { recordTaskAudio, startRecording, playBeep, setCondition, setEventMarker } from '../utils/helpers.js';
import './PRSComponent.css';

const PRSComponent = ({ 
  questionSet = 'prs_1', 
  procedure, 
  prsSequenceNumber, 
  sessionId, 
  onTaskComplete, 
  isExperimenterMode = false,
  procedureActive = false
}) => {
  const validQuestionSets = ['prs_1', 'prs_2', 'prs_3'];
  const selectedQuestionSet = validQuestionSets.includes(questionSet) ? questionSet : 'prs_1';
  
  // State management
  const [audioFiles, setAudioFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // const [procedureStarted, setProcedureStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [introFinished, setIntroFinished] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);
  const [waitingForInstructions, setWaitingForInstructions] = useState(false);
  const [eventMarker, setEventMarkerState] = useState('');
  const [condition, setConditionState] = useState('None');
  
  // Refs for audio elements and timers
  const introAudioRef = useRef(null);
  const waitAudioRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  const currentQuestionAudioRef = useRef(null);

  const AUDIO_DIR = `/audio_files/${selectedQuestionSet}/`;
  const INTRO_FILE = '1-PRS-Intro.mp3';
  const WAIT_FILE = 'Wait_For_Instructions.mp3';

  useEffect(() => {
    const fetchAudioFiles = async () => {
      try {
        console.log(`Fetching audio files for question set: ${selectedQuestionSet}`);
        const response = await fetch(`/api/audio-files/${selectedQuestionSet}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch audio files: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.question_files) {
          console.log(`Found ${data.question_files.length} question files:`, data.question_files);
          const shuffled = [...data.question_files];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          
          setAudioFiles(shuffled);
          console.log('Audio files shuffled and set:', shuffled);
          console.log('Shuffled order:', shuffled.map((file, idx) => `${idx + 1}: ${file}`));
        } else {
          console.error('Invalid response format:', data);
          setAudioFiles([]);
        }
      } catch (error) {
        console.error('Error fetching audio files:', error);
        setAudioFiles([]);
      }
    };

    const eventMarker = `PRS_${prsSequenceNumber || 1}`;
    let storedCondition = localStorage.getItem('currentCondition') || 'None';
    
    if (procedure?.configuration?.['question-set']?.conditionMarker) {
      storedCondition = procedure.configuration['question-set'].conditionMarker;
    } else if (procedure?.wizardData?.conditionMarker) {
      storedCondition = procedure.wizardData.conditionMarker;
    }
    
    setEventMarkerState(eventMarker);
    setConditionState(storedCondition);
    setEventMarker(eventMarker);
    setCondition(storedCondition);
    
    fetchAudioFiles();
  }, [selectedQuestionSet, procedure, prsSequenceNumber]);

  // const handleStartProcedure = async () => {
  //   try {
  //     const response = await fetch(`/api/sessions/${sessionId}/set-current-procedure`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         current_procedure: procedure.position || 0,
  //         procedure_name: procedure.name,
  //         timestamp: new Date().toISOString()
  //       })
  //     });
      
  //     if (response.ok) {
  //       setProcedureStarted(true);
  //     }
  //   } catch (error) {
  //     console.error('Error starting procedure:', error);
  //   }
  // };

  const handleIntroEnd = () => {
    console.log("Intro finished, starting first randomized audio...");
    setIntroFinished(true);
    setTimeout(() => {
      playNextAudio();
    }, 500);
  };

  const playNextAudio = () => {
    console.log(`playNextAudio called: currentIndex=${currentIndex}, audioFiles.length=${audioFiles.length}`);
    
    if (currentIndex < audioFiles.length) {
      const audioFile = audioFiles[currentIndex];
      const baseName = audioFile.replace(/\.[^/.]+$/, "");
      
      setRecordingStatus('');
      console.log(`Playing audio ${currentIndex + 1}/${audioFiles.length}: ${baseName}`);
      
      if (currentQuestionAudioRef.current) {
        currentQuestionAudioRef.current.load();
        currentQuestionAudioRef.current.play().catch(console.error);
      }
    } else {
      console.log(`All questions completed, playing wait instructions`);
      playWaitForInstructions();
    }
  };

  const playWaitForInstructions = () => {
    console.log("All questions completed, playing Wait_For_Instructions.mp3");
    setWaitingForInstructions(true);
    setRecordingStatus('Playing final instructions...');
    
    if (waitAudioRef.current) {
      waitAudioRef.current.load();
      waitAudioRef.current.play().catch(console.error);
    }
  };

  const handleWaitInstructionsEnd = async () => {
    console.log("Wait for instructions completed, auto-completing task");
    setAllCompleted(true);
    setEventMarker('subject_idle');
    setCondition('None');
    
    if (onTaskComplete) {
      try {
        await onTaskComplete();
        console.log("PRS task auto-completed successfully");
      } catch (error) {
        console.error("Error auto-completing PRS task:", error);
      }
    }
  };

  const handleAudioEnd = () => {
    if (currentIndex < audioFiles.length) {
      const audioFile = audioFiles[currentIndex];
      const baseName = audioFile.replace(/\.[^/.]+$/, "");
      console.log(`Finished audio ${currentIndex + 1}/${audioFiles.length}: ${baseName}`);
      startRecordingForSegment(baseName);
    }
  };

  const startRecordingForSegment = (baseName) => {
    setIsRecording(true);
    setRecordingStatus(`Recording started for ${baseName}...`);
    
    try {
      const emarker = `${eventMarker}_${baseName}`;
      setEventMarker(emarker);
      startRecording();
      playBeep(); 
      
      console.log(`Recording started for ${baseName} (question ${currentIndex + 1}/${audioFiles.length})`);

      beepTimeoutRef.current = setTimeout(() => {
        playBeep();
        setTimeout(playBeep, 500); 
      }, 15000);

      recordingTimeoutRef.current = setTimeout(() => {
        stopRecordingForSegment(baseName);
      }, 20000);
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingStatus(`Recording failed: ${error.message}`);
    }
  };

  const stopRecordingForSegment = (baseName) => {
    setIsRecording(false);
    console.log(`Stopping recording for ${baseName} (question ${currentIndex + 1}/${audioFiles.length})`);
    
    recordTaskAudio(eventMarker, condition, 'stop', baseName, (message) => {
      setRecordingStatus(message);
    });
    
    setRecordingStatus("Recording stopped.");
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
    }
    
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    
    setTimeout(() => {
      if (nextIndex < audioFiles.length) {
        playNextAudio();
      } else {
        playWaitForInstructions();
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current);
      }
    };
  }, []);

  if (isExperimenterMode) {
    if (!procedureActive) {
      return (
        <div className="prs-experimenter-control">
          <p style={{ color: '#666', fontStyle: 'italic' }}>Click the PRS procedure in the procedure list to activate controls.</p>
        </div>
      );
    }
    
    return (
      <div className="prs-experimenter-control">
        <div className="prs-status">
          <div className={`status-indicator ${isRecording ? 'recording' : ''}`}>
            <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
            <span>
              {isRecording ? 'Recording...' : 
              allCompleted ? 'Completed' : 
              waitingForInstructions ? 'Final instructions' :
              introFinished ? `Q${currentIndex + 1}/${audioFiles.length}` : 
              'Introduction'}
            </span>
          </div>
        </div>

        <div className="prs-controls">
          <div className="intro-control" style={{ display: !introFinished ? 'block' : 'none' }}>
            <label>Introduction Audio:</label>
            <audio 
              ref={introAudioRef}
              controls
              onEnded={handleIntroEnd}
              style={{ width: '100%', marginBottom: '10px' }}
            >
              <source src={`${AUDIO_DIR}${INTRO_FILE}`} type="audio/mpeg" />
            </audio>
          </div>

          {introFinished && !waitingForInstructions && currentIndex < audioFiles.length && (
            <div className="question-control">
              <label>Question {currentIndex + 1} of {audioFiles.length}: {audioFiles[currentIndex]?.replace(/\.[^/.]+$/, "")}</label>
              <audio 
                ref={currentQuestionAudioRef}
                controls
                onEnded={handleAudioEnd}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                <source src={`${AUDIO_DIR}${audioFiles[currentIndex]}`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          <div className="wait-control" style={{ display: waitingForInstructions ? 'block' : 'none' }}>
            <label>Final Instructions:</label>
            <audio 
              ref={waitAudioRef}
              controls
              onEnded={handleWaitInstructionsEnd}
              style={{ width: '100%', marginBottom: '10px' }}
            >
              <source src={`${AUDIO_DIR}${WAIT_FILE}`} type="audio/mpeg" />
            </audio>
          </div>
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
    <div className="prs-component">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>PRS Task</h2>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instruction Text</h4>
          <ul>
            <li>For the next section of the experiment, we will be asking you to rate the extent to which a given statement describes your experience in this room.</li>
            <li>The scale will be from 0 to 6. An answer of 0 means "Not at all" and an answer of 6 means "Completely".</li>
            <li>After each question, you can take as much time as you need to think about it before speaking your response aloud. Then, you will provide a reason for each rating you provide.</li>
            <li>The statements will begin now. As a reminder, you will answer with a number from 0 to 6, with 0 being "Not at all" and 6 being "Completely".</li>
            <li>Please provide a brief explanation for your answer after each question.</li>
          </ul>
        </div>

        <div className="task-interface">
          {!introFinished && (
            <div className="intro-section">
              <h3>Introduction</h3>
              <div className="audio-container">
                <audio 
                  ref={introAudioRef}
                  controls
                  onEnded={handleIntroEnd}
                >
                  <source src={`${AUDIO_DIR}${INTRO_FILE}`} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}

          {introFinished && !waitingForInstructions && currentIndex < audioFiles.length && (
            <div className="prs-questions">
              <div className="current-question">
                <h3>Question {currentIndex + 1} of {audioFiles.length}</h3>
                <div className="audio-container">
                  <audio 
                    ref={currentQuestionAudioRef}
                    controls
                    onEnded={handleAudioEnd}
                  >
                    <source src={`${AUDIO_DIR}${audioFiles[currentIndex]}`} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <div className="recording-status">
                    {recordingStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {waitingForInstructions && (
            <div className="wait-instructions">
              <h3>Final Instructions</h3>
              <div className="audio-container">
                <audio 
                  ref={waitAudioRef}
                  controls
                  onEnded={handleWaitInstructionsEnd}
                >
                  <source src={`${AUDIO_DIR}${WAIT_FILE}`} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}

          {allCompleted && (
            <div className="completion-message">
              <h3>PRS Task Completed</h3>
              <p>Thank you for completing the Perceived Restorativeness Scale task.</p>
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
             allCompleted ? 'Task completed' : 
             waitingForInstructions ? 'Playing final instructions' :
             introFinished ? `Question ${currentIndex + 1} of ${audioFiles.length}` : 
             'Listen to introduction'}
          </span>
        </div>
        <div className="progress-info">
          Progress: {introFinished ? currentIndex : 0} / {audioFiles.length}
        </div>
      </div>
    </div>
  );
};

export default PRSComponent;