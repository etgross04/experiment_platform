import React, { useState, useEffect, useRef } from 'react';
import { recordTaskAudio, startRecording, playBeep, setCondition, setEventMarker } from '../utils/helpers.js';
import './MainTaskComponent.css';

const MainTaskComponent = ({ 
  questionSet = 'main_task_1',
  procedure, 
  sessionId, 
  onTaskComplete, 
  isExperimenterMode = false ,
  procedureActive = false
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // const [procedureStarted, setProcedureStarted] = useState(false);

  // Audio refs
  const audioRefs = useRef({});
  const observationTimerRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  
  const AUDIO_DIR = `/audio_files/main_task_audio/${selectedQuestionSet}/`;

  useEffect(() => {
  const loadAudioFiles = async () => {
    try {
      const response = await fetch(`/api/main-task-audio/${selectedQuestionSet}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('=== AUDIO FILE LOADING DEBUG ===');
        console.log('All files from server:', data.files);
        
        // Find questions with VERY simple pattern
        const questionFiles = data.files.filter(f => {
          const fileNum = parseInt(f.match(/^(\d+)-/)?.[1]);
          const hasQ = f.toUpperCase().includes('Q');
          
          console.log(`File: ${f}`);
          console.log(`  - Starts with number: ${fileNum}`);
          console.log(`  - Number >= 3: ${fileNum >= 3}`);
          console.log(`  - Contains Q: ${hasQ}`);
          console.log(`  - MATCH: ${fileNum >= 3 && hasQ}`);
          
          return fileNum >= 3 && hasQ;
        }).sort((a, b) => {
          const numA = parseInt(a.match(/^(\d+)-/)[1]);
          const numB = parseInt(b.match(/^(\d+)-/)[1]);
          return numA - numB;
        });
        
        const files = {
          intro: data.files.find(f => f.startsWith('1-')),
          preQuestions: data.files.find(f => f.startsWith('2-')),
          questions: questionFiles,
          wait: data.files.find(f => f.toLowerCase().includes('wait'))
        };
        
        console.log('=== FINAL PARSED FILES ===');
        console.log('Intro:', files.intro);
        console.log('PreQuestions:', files.preQuestions);
        console.log('Questions:', files.questions);
        console.log('Wait:', files.wait);
        console.log('Number of questions:', files.questions.length);
        
        if (files.questions.length === 0) {
          console.error('NO QUESTIONS FOUND!');
          console.error('Files must: 1) Start with "3-", "4-", etc. AND 2) Contain the letter Q');
        }
        
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
      if (onEndedCallback) {
        ref.onended = onEndedCallback;
      }
      ref.play()
        .then(() => console.log(`Playing ${audioType}`))
        .catch(err => console.error(`Error playing ${audioType}:`, err));
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
    setCurrentQuestionIndex(0);
    setCurrentPhase('question');
    setTimeout(() => playAudio(`question_${0}`, handleQuestionEnd), 500);
  };

  const handleQuestionEnd = () => {
    console.log(`Question ${currentQuestionIndex + 1} finished, starting recording...`);
    startRecordingForQuestion(currentQuestionIndex);
  };

  const startRecordingForQuestion = (questionIndex) => {
    setIsRecording(true);
    setRecordingStatus(`Recording started for question ${questionIndex + 1}... 90 second timer started.`);
    
    try {
      const emarker = `${eventMarker}_question_${questionIndex + 1}`;
      setEventMarker(emarker);
      startRecording();
      playBeep();
      
      console.log(`Recording started for question ${questionIndex + 1}`);

      beepTimeoutRef.current = setTimeout(() => {
        playBeep();
        setTimeout(playBeep, 500);
      }, 75000);

      recordingTimeoutRef.current = setTimeout(() => {
        stopRecordingForQuestion(questionIndex);
      }, 90000);
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingStatus(`Recording failed: ${error.message}`);
    }
  };

  const stopRecordingForQuestion = (questionIndex) => {
    setIsRecording(false);
    console.log(`Stopping recording for question ${questionIndex + 1}`);
    
    recordTaskAudio(eventMarker, condition, 'stop', `question_${questionIndex + 1}`, (message) => {
      setRecordingStatus(message);
    });
    
    setRecordingStatus("Recording stopped.");
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
    }
    
    const nextQuestionIndex = questionIndex + 1;
    if (nextQuestionIndex < audioFiles.questions.length) {
      console.log(`Recording ${questionIndex + 1} complete, auto-playing Question ${nextQuestionIndex + 1}...`);
      setCurrentQuestionIndex(nextQuestionIndex);
      setTimeout(() => playAudio(`question_${nextQuestionIndex}`, handleQuestionEnd), 500);
    } else {
      console.log(`All questions complete, auto-playing wait instructions...`);
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

  // const handleStartProcedure = async () => {
  //   try {
  //     const response = await fetch(`/api/sessions/${sessionId}/set-current-procedure`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         current_procedure: procedure.position || 0,
  //         procedure_name: procedure.name,
  //         timestamp: new Date().toISOString()
  //       })
  //     });
      
  //     if (response.ok) {
  //       setProcedureStarted(true);
  //       console.log('Main Task procedure started and subject interface notified');
  //     } else {
  //       console.error('Failed to start procedure');
  //       alert('Failed to start procedure. Please try again.');
  //     }
  //   } catch (error) {
  //     console.error('Error starting procedure:', error);
  //     alert('Error starting procedure. Please try again.');
  //   }
  // };

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
    if (!procedureActive) {
      return (
        <div className="main-task-experimenter-control">
          <p style={{ color: '#666', fontStyle: 'italic' }}>Click the Main Task procedure in the procedure list to activate controls.</p>
        </div>
      );
    }
    
    return (
      <div className="main-task-experimenter-control">
        <div className="main-task-status">
          <div className={`status-indicator ${isRecording ? 'recording' : ''}`}>
            <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
            <span>
              {isRecording ? 'Recording...' : 
               currentPhase === 'completed' ? 'Completed' : 
               currentPhase === 'wait' ? 'Final instructions' :
               currentPhase === 'observation' ? `Observing (${observationTimeLeft}s)` :
               currentPhase === 'question' ? `Question ${currentQuestionIndex + 1}` :
               currentPhase === 'preQuestions' ? 'Pre-Questions' :
               'Introduction'}
            </span>
          </div>
        </div>

        <div className="main-task-controls">
          {/* Keep all audio elements mounted but hidden, show only the current one */}
          <div className="intro-control" style={{ display: currentPhase === 'intro' ? 'block' : 'none' }}>
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

          <div className="observation-control" style={{ display: currentPhase === 'observation' ? 'block' : 'none' }}>
            <label>Observation Period:</label>
            <div className="observation-timer-display">
              <div className="timer-count">{observationTimeLeft}s</div>
              <div className="timer-text">Observation time remaining</div>
            </div>
          </div>

          <div className="instructions-control" style={{ display: currentPhase === 'preQuestions' ? 'block' : 'none' }}>
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

          {audioFiles.questions?.map((questionFile, idx) => (
            <div 
              key={idx}
              className="question-control" 
              style={{ display: currentPhase === 'question' && currentQuestionIndex === idx ? 'block' : 'none' }}
            >
              <label>Question {idx + 1}:</label>
              <audio 
                ref={el => audioRefs.current[`question_${idx}`] = el}
                controls
                onEnded={handleQuestionEnd}
                className="audio-control"
              >
                <source src={`${AUDIO_DIR}${questionFile}`} type="audio/mpeg" />
              </audio>
            </div>
          ))}

          <div className="wait-control" style={{ display: currentPhase === 'wait' ? 'block' : 'none' }}>
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

          <div className="completion-control" style={{ display: currentPhase === 'completed' ? 'block' : 'none' }}>
            <label>Task Completed</label>
            <div className="completion-display">
              Main task automation sequence completed successfully.
            </div>
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

  // Subject mode rendering
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
        <audio key={idx} ref={el => audioRefs.current[`question_${idx}`] = el} style={{ display: 'none' }}>
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

          {currentPhase === 'question' && (
            <div className="question-section">
              <h3>Question {currentQuestionIndex + 1} (Playing Automatically)</h3>
              <div className="auto-play-indicator">
                <p>Playing: {audioFiles.questions?.[currentQuestionIndex]}</p>
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
             currentPhase === 'question' ? `Question ${currentQuestionIndex + 1}` :
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