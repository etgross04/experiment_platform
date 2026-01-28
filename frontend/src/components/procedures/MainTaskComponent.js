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
  const [audioFiles, setAudioFiles] = useState(null);
  const [loading, setLoading] = useState(true);

  // Audio refs
  const audioRefs = useRef({});
  const observationTimerRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  
  const AUDIO_DIR = `/audio_files/main_task_audio/${selectedQuestionSet}/`;

  // Load available audio files
  useEffect(() => {
    const loadAudioFiles = async () => {
      try {
        const response = await fetch(`/api/main-task-audio/${selectedQuestionSet}`);
        const data = await response.json();
        
        if (data.success) {
          // Categorize files
          const files = {
            intro: data.files.find(f => f.startsWith('1-') && f.toLowerCase().includes('intro')),
            preQuestions: data.files.find(f => f.startsWith('2-') && f.toLowerCase().includes('pre')),
            questions: data.files.filter(f => f.toLowerCase().includes('question_')).sort(),
            wait: data.files.find(f => f.toLowerCase().includes('wait_for_instructions'))
          };
          
          console.log('Loaded audio files:', files);
          setAudioFiles(files);
        } else {
          console.error('Failed to load audio files:', data.error);
        }
      } catch (error) {
        console.error('Error loading audio files:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAudioFiles();
  }, [selectedQuestionSet]);

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

  const playAudio = (audioType, onEndedCallback) => {
    const ref = audioRefs.current[audioType];
    if (ref) {
      ref.load();
      ref.play()
        .then(() => console.log(`Playing ${audioType}`))
        .catch(err => console.error(`Error playing ${audioType}:`, err));
      
      if (onEndedCallback) {
        ref.onended = onEndedCallback;
      }
    }
  };

  const handleIntroEnd = () => {
    console.log("Intro finished, starting 60-second observation period...");
    setCurrentPhase('observation');
    setRecordingStatus('60 second observation timer started...');
    
    observationTimerRef.current = setInterval(() => {
      setObservationTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(observationTimerRef.current);
          console.log("Observation complete, auto-playing pre-questions...");
          setCurrentPhase('preQuestions');
          setRecordingStatus(' ');
          setTimeout(() => playAudio('preQuestions', handlePreQuestionsEnd), 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePreQuestionsEnd = () => {
    console.log("Pre-questions finished, auto-playing first question...");
    setCurrentPhase('question1');
    setTimeout(() => playAudio('question1', handleQuestion1End), 500);
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

      beepTimeoutRef.current = setTimeout(() => {
        playBeep();
        setTimeout(playBeep, 500);
      }, 75000);

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
    
    if (questionType === 'question1') {
      console.log("Recording 1 complete, auto-playing Question 2...");
      setCurrentPhase('question2');
      setTimeout(() => playAudio('question2', handleQuestion2End), 500);
    } else if (questionType === 'question2') {
      console.log("Recording 2 complete, auto-playing wait instructions...");
      setCurrentPhase('wait');
      setTimeout(() => playAudio('wait', handleWaitInstructionsEnd), 500);
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

  if (loading || !audioFiles) {
    return (
      <div className="main-task-component">
        <p>Loading audio files...</p>
      </div>
    );
  }

  if (isExperimenterMode) {
    return (
      <div className="main-task-experimenter-control">
        {/* Create audio elements dynamically */}
        {audioFiles.intro && (
          <audio ref={el => audioRefs.current.intro = el} style={{ display: 'none' }}>
            <source src={`${AUDIO_DIR}${audioFiles.intro}`} type="audio/mpeg" />
          </audio>
        )}
        {audioFiles.preQuestions && (
          <audio ref={el => audioRefs.current.preQuestions = el} style={{ display: 'none' }}>
            <source src={`${AUDIO_DIR}${audioFiles.preQuestions}`} type="audio/mpeg" />
          </audio>
        )}
        {audioFiles.questions?.[0] && (
          <audio ref={el => audioRefs.current.question1 = el} style={{ display: 'none' }}>
            <source src={`${AUDIO_DIR}${audioFiles.questions[0]}`} type="audio/mpeg" />
          </audio>
        )}
        {audioFiles.questions?.[1] && (
          <audio ref={el => audioRefs.current.question2 = el} style={{ display: 'none' }}>
            <source src={`${AUDIO_DIR}${audioFiles.questions[1]}`} type="audio/mpeg" />
          </audio>
        )}
        {audioFiles.wait && (
          <audio ref={el => audioRefs.current.wait = el} style={{ display: 'none' }}>
            <source src={`${AUDIO_DIR}${audioFiles.wait}`} type="audio/mpeg" />
          </audio>
        )}

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
               currentPhase === 'preQuestions' ? 'Pre-Questions' :
               'Introduction'}
            </span>
          </div>
        </div>

        <div className="main-task-controls">
          {currentPhase === 'intro' && audioFiles.intro && (
            <div className="intro-control">
              <label>Introduction Audio:</label>
              <audio 
                ref={el => audioRefs.current.intro = el}
                controls
                onEnded={handleIntroEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}${audioFiles.intro}`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'observation' && (
            <div className="observation-control">
              <label>Observation Period:</label>
              <div className="observation-timer-display">
                <div className="timer-count">{observationTimeLeft}s</div>
                <div className="timer-text">Observation time remaining</div>
              </div>
            </div>
          )}

          {currentPhase === 'preQuestions' && audioFiles.preQuestions && (
            <div className="instructions-control">
              <label>Pre-Questions Instructions:</label>
              <audio 
                ref={el => audioRefs.current.preQuestions = el}
                controls
                onEnded={handlePreQuestionsEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}${audioFiles.preQuestions}`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'question1' && audioFiles.questions?.[0] && (
            <div className="question-control">
              <label>Question 1:</label>
              <audio 
                ref={el => audioRefs.current.question1 = el}
                controls
                onEnded={handleQuestion1End}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}${audioFiles.questions[0]}`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'question2' && audioFiles.questions?.[1] && (
            <div className="question-control">
              <label>Question 2:</label>
              <audio 
                ref={el => audioRefs.current.question2 = el}
                controls
                onEnded={handleQuestion2End}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}${audioFiles.questions[1]}`} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {currentPhase === 'wait' && audioFiles.wait && (
            <div className="wait-control">
              <label>Final Instructions:</label>
              <audio 
                ref={el => audioRefs.current.wait = el}
                controls
                onEnded={handleWaitInstructionsEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}${audioFiles.wait}`} type="audio/mpeg" />
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

  // Subject mode rendering (full UI) - similar changes apply here
  return (
    <div className="main-task-component">
      {/* Hidden audio elements */}
      {audioFiles.intro && (
        <audio ref={el => audioRefs.current.intro = el} style={{ display: 'none' }}>
          <source src={`${AUDIO_DIR}${audioFiles.intro}`} type="audio/mpeg" />
        </audio>
      )}
      {audioFiles.preQuestions && (
        <audio ref={el => audioRefs.current.preQuestions = el} style={{ display: 'none' }}>
          <source src={`${AUDIO_DIR}${audioFiles.preQuestions}`} type="audio/mpeg" />
        </audio>
      )}
      {audioFiles.questions?.map((questionFile, idx) => (
        <audio key={idx} ref={el => audioRefs.current[`question${idx + 1}`] = el} style={{ display: 'none' }}>
          <source src={`${AUDIO_DIR}${questionFile}`} type="audio/mpeg" />
        </audio>
      ))}
      {audioFiles.wait && (
        <audio ref={el => audioRefs.current.wait = el} style={{ display: 'none' }}>
          <source src={`${AUDIO_DIR}${audioFiles.wait}`} type="audio/mpeg" />
        </audio>
      )}

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
                  <source src={`${AUDIO_DIR}${audioFiles.intro}`} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}

          {currentPhase === 'observation' && (
            <div className="observation-section">
              <h3>Observation Period</h3>
              <div className="observation-timer">
                <div className="timer-display">{observationTimeLeft}</div>
                <div className="timer-label">seconds remaining</div>
              </div>
              <div className="recording-status">{recordingStatus}</div>
            </div>
          )}

          {currentPhase === 'preQuestions' && (
            <div className="instructions-section">
              <h3>Instructions (Playing Automatically)</h3>
              <div className="auto-play-indicator">
                <p>Playing: {audioFiles.preQuestions}</p>
              </div>
            </div>
          )}

          {(currentPhase === 'question1' || currentPhase === 'question2') && (
            <div className="question-section">
              <h3>{currentPhase === 'question1' ? 'Question 1 (Playing Automatically)' : 'Question 2 (Playing Automatically)'}</h3>
              <div className="auto-play-indicator">
                <p>Playing: {currentPhase === 'question1' ? audioFiles.questions?.[0] : audioFiles.questions?.[1]}</p>
                <div className="recording-status">{recordingStatus}</div>
              </div>
            </div>
          )}

          {currentPhase === 'wait' && (
            <div className="wait-instructions">
              <h3>Final Instructions (Playing Automatically)</h3>
              <div className="auto-play-indicator">
                <p>Playing: {audioFiles.wait}</p>
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
             currentPhase === 'preQuestions' ? 'Playing pre-questions instructions' :
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