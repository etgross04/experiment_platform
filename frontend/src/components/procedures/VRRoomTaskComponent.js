import React, { useState, useEffect, useRef } from 'react';
import { startRecording, playBeep, setCondition, setEventMarker } from '../utils/helpers.js';
import './MainTaskComponent.css'; // Reuse same styling

const VRRoomTaskComponent = ({ 
  audioSet = 'vr_room_task_1',
  procedure, 
  sessionId, 
  onTaskComplete, 
  isExperimenterMode = false,
  procedureActive = false,
  configuration = {}
}) => {
  const validAudioSets = ['vr_room_task_1', 'vr_room_task_2'];
  const selectedAudioSet = validAudioSets.includes(audioSet) ? audioSet : 'vr_room_task_1';
  
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [timeoutRemaining, setTimeoutRemaining] = useState(0);
  const [eventMarker, setEventMarkerState] = useState('');
  const [condition, setConditionState] = useState('None');
  const [audioFiles, setAudioFiles] = useState(null);
  const [sequenceConfig, setSequenceConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Refs
  const audioRefs = useRef({});
  const timeoutRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const beepTimeoutRef = useRef(null);
  
  const AUDIO_DIR = `/audio_files/vr_room_audio/${selectedAudioSet}/`;

  // Load audio files and configuration
  useEffect(() => {
    const loadAudioFilesAndConfig = async () => {
      try {
        const audioSet = configuration['audio-set-selection']?.audioSet || selectedAudioSet;
        const sessionType = configuration['session-type-selection']?.sessionType || 'practice';
        
        // Check if we have an edited config from the wizard
        const wizardEditedConfig = configuration['sequence-editor']?.editableConfig;
        
        let fullConfig;
        
        if (wizardEditedConfig && wizardEditedConfig.steps) {
          // Use the edited config from the wizard
          console.log('=== VR ROOM TASK LOADING (WIZARD-EDITED) ===');
          console.log('Using wizard-edited configuration');
          fullConfig = { steps: wizardEditedConfig.steps };
        } else {
          // Fetch config from server
          console.log('=== VR ROOM TASK LOADING (SERVER) ===');
          const configResponse = await fetch(`/api/vr-room-config/${audioSet}`);
          const configData = await configResponse.json();
          
          if (!configData.success) {
            console.error('Failed to load VR room config');
            setLoading(false);
            return;
          }
          
          fullConfig = configData.config;
        }
        
        // Filter steps based on session type
        const filteredSteps = fullConfig.steps.filter(step => {
          return step.sessionTypes && step.sessionTypes.includes(sessionType);
        });
        
        console.log(`Session type: ${sessionType}`);
        console.log(`Total steps in config: ${fullConfig.steps.length}`);
        console.log(`Filtered steps for this session: ${filteredSteps.length}`);
        
        setSequenceConfig({ steps: filteredSteps });
        
        // Load audio files
        const audioFilesNeeded = filteredSteps
          .filter(step => step.file)
          .map(step => step.file);
        
        console.log('Audio files needed:', audioFilesNeeded);
        
        const audioResponse = await fetch(`/api/vr-room-audio/${audioSet}`);
        const audioData = await audioResponse.json();
        
        if (!audioData.success) {
          console.error('Failed to load VR room audio files');
          setLoading(false);
          return;
        }
        
        const allAudioFiles = audioData.files;
        const relevantAudioFiles = allAudioFiles.filter(file => 
          audioFilesNeeded.includes(file)
        );
        
        console.log('Available audio files:', allAudioFiles);
        console.log('Relevant audio files:', relevantAudioFiles);
        
        setAudioFiles(relevantAudioFiles);
        
        console.log('=== VR ROOM TASK LOADED SUCCESSFULLY ===');
        
      } catch (error) {
        console.error('Error loading VR room task:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAudioFilesAndConfig();
  }, [selectedAudioSet, configuration]);

  // Initialize condition and event marker
  useEffect(() => {
    let taskCondition = 'vr_room_task';
    
    if (procedure?.configuration?.['task-description']?.conditionMarker) {
      taskCondition = procedure.configuration['task-description'].conditionMarker;
    } else if (procedure?.wizardData?.rawConfiguration?.['task-description']?.conditionMarker) {
      taskCondition = procedure.wizardData.rawConfiguration['task-description'].conditionMarker;
    }
    
    const taskEventMarker = 'vr_room_task';
    
    setEventMarkerState(taskEventMarker);
    setConditionState(taskCondition);
    setEventMarker(taskEventMarker);
    setCondition(taskCondition);
    
    console.log('VR Room Task initialized with condition:', taskCondition, 'event marker:', taskEventMarker, 'audio set:', selectedAudioSet);
  }, [procedure, selectedAudioSet]);

  const playAudio = (stepIndex, onEndedCallback) => {
    const ref = audioRefs.current[`step_${stepIndex}`];
    if (ref) {
      if (onEndedCallback) {
        ref.onended = onEndedCallback;
      }
      ref.play()
        .then(() => console.log(`Playing step ${stepIndex}`))
        .catch(err => console.error(`Error playing step ${stepIndex}:`, err));
    }
  };

  const getCurrentStep = () => {
    if (!sequenceConfig || !sequenceConfig.steps || currentStepIndex >= sequenceConfig.steps.length) {
      return null;
    }
    return sequenceConfig.steps[currentStepIndex];
  };

  const handleStepEnd = () => {
  const step = getCurrentStep();
  if (!step) return;

  console.log(`Step ${currentStepIndex} audio ended`);
  
  // Handle beep after audio if configured
  if (step.beepAfter) {
    playBeep();
  }

  // Handle recording if this is a recording step type
  if (step.stepType === 'recording') {
    startRecordingForStep(currentStepIndex);
  }
  // Handle timeout if configured
  else if (step.timeout > 0) {
    startTimeoutForStep(currentStepIndex);
  }
  // Move to next step if no recording or timeout
  else {
    proceedToNextStep();
  }
};

  const startTimeoutForStep = (stepIndex) => {
    const step = sequenceConfig.steps[stepIndex];
    console.log(`Starting timeout for step ${stepIndex}: ${step.timeout} seconds`);
    
    setTimeoutRemaining(step.timeout);
    setRecordingStatus(`Waiting ${step.timeout} seconds...`);
    
    timeoutRef.current = setInterval(() => {
      setTimeoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timeoutRef.current);
          console.log(`Timeout complete for step ${stepIndex}`);
          setRecordingStatus('');
          proceedToNextStep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecordingForStep = (stepIndex) => {
    const step = sequenceConfig.steps[stepIndex];
    setIsRecording(true);
    setRecordingStatus(`Recording started for step ${stepIndex + 1}... ${step.recordingDuration || 90} second timer started.`);
    
    try {
      const emarker = `${eventMarker}_step_${stepIndex + 1}`;
      setEventMarker(emarker);
      startRecording();
      playBeep();
      
      console.log(`Recording started for step ${stepIndex + 1}`);

      // Warning beeps at configured time (defaults to 15 seconds before end if not configured)
      const warningTime = step.warningBeepAt !== undefined 
        ? step.warningBeepAt 
        : Math.max(0, (step.recordingDuration || 90) - 15);
        
      beepTimeoutRef.current = setTimeout(() => {
        playBeep();
        setTimeout(playBeep, 500);
      }, warningTime * 1000);

      // Stop recording after duration
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecordingForStep(stepIndex);
      }, (step.recordingDuration || 90) * 1000);
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingStatus(`Recording failed: ${error.message}`);
    }
  };

  const stopRecordingForStep = (stepIndex) => {
    setIsRecording(false);
    console.log(`Stopping recording for step ${stepIndex + 1}`);
    
    const step = sequenceConfig.steps[stepIndex];
    const stepName = step.file ? step.file.replace(/\.[^/.]+$/, "") : `step_${stepIndex + 1}`;
    
    // Call VR Room-specific endpoint
    fetch('/api/vr-room/stop-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepName: stepName,
        eventMarker: eventMarker,
        condition: condition
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status && data.file_name) {
        console.log(`Recording saved: ${data.file_name}`);
        setRecordingStatus("Recording stopped.");
      } else {
        console.error('Failed to stop recording:', data.message);
        setRecordingStatus('Failed to save recording');
      }
    })
    .catch(error => {
      console.error("Error stopping recording:", error);
      setRecordingStatus(`Error: ${error.message}`);
    });
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
    }
    
    proceedToNextStep();
  };

  const proceedToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    
    if (nextIndex < sequenceConfig.steps.length) {
      console.log(`Moving to step ${nextIndex + 1}`);
      setCurrentStepIndex(nextIndex);
      
      // Play next step after short delay
      setTimeout(() => {
        const nextStep = sequenceConfig.steps[nextIndex];
        
        // Play beep before if configured
        if (nextStep.beepBefore) {
          playBeep();
          // Small delay after beep before playing audio
          setTimeout(() => playAudio(nextIndex, handleStepEnd), 300);
        } else {
          playAudio(nextIndex, handleStepEnd);
        }
      }, 500);
    } else {
      console.log('All steps complete, task finished');
      handleTaskComplete();
    }
  };

  const handleTaskComplete = async () => {
    console.log("VR Room Task completed");
    setEventMarker('subject_idle');
    setCondition('None');
    
    if (onTaskComplete) {
      try {
        await onTaskComplete();
        console.log("VR Room Task auto-completed successfully");
      } catch (error) {
        console.error("Error auto-completing VR room task:", error);
      }
    }
  };

  const startTask = () => {
    if (!sequenceConfig || !audioFiles) {
      console.error('Cannot start task: missing config or audio files');
      return;
    }
    
    console.log('Starting VR Room Task');
    setCurrentStepIndex(0);
    
    const firstStep = sequenceConfig.steps[0];
    if (firstStep.beepBefore) {
      playBeep();
      setTimeout(() => playAudio(0, handleStepEnd), 300);
    } else {
      playAudio(0, handleStepEnd);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current);
      }
    };
  }, []);

  if (loading || !audioFiles || !sequenceConfig) {
    return (
      <div className="main-task-component">
        <p>Loading VR room task...</p>
      </div>
    );
  }

  // Experimenter mode rendering
  if (isExperimenterMode) {
    if (!procedureActive) {
      return (
        <div className="main-task-experimenter-control">
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Click the VR Room Task procedure in the procedure list to activate controls.
          </p>
        </div>
      );
    }
    
    const currentStep = getCurrentStep();
    const totalSteps = sequenceConfig.steps.length;
    
    return (
      <div className="main-task-experimenter-control">
        <div className="main-task-status">
          <div className={`status-indicator ${isRecording ? 'recording' : ''}`}>
            <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
            <span>
              {isRecording ? 'Recording...' : 
               currentStepIndex >= totalSteps ? 'Completed' :
               currentStep?.timeout > 0 && timeoutRemaining > 0 ? `Timeout (${timeoutRemaining}s)` :
               `Step ${currentStepIndex + 1}/${totalSteps}`}
            </span>
          </div>
        </div>

        <div className="main-task-controls">
          {currentStepIndex >= totalSteps ? (
            <div className="completion-control">
              <label>Task Completed</label>
              <div className="completion-display">
                VR room task sequence completed successfully.
              </div>
            </div>
          ) : (
            <>
              {currentStepIndex === 0 && !isRecording && timeoutRemaining === 0 && (
                <div className="start-control">
                  <button onClick={startTask} className="start-task-btn">
                    ▶️ Start VR Room Task
                  </button>
                </div>
              )}
              
              <div className="current-step-control">
                <label>Current Step: {currentStep?.file}</label>
                {currentStep && (
                  <audio 
                    ref={el => audioRefs.current[`step_${currentStepIndex}`] = el}
                    controls
                    onEnded={handleStepEnd}
                    className="audio-control"
                    style={{ display: currentStepIndex > 0 || timeoutRemaining > 0 || isRecording ? 'block' : 'none' }}
                  >
                    <source src={`${AUDIO_DIR}${currentStep.file}`} type="audio/mpeg" />
                  </audio>
                )}
                
                {timeoutRemaining > 0 && (
                  <div className="observation-timer-display" style={{ marginTop: '10px' }}>
                    <div className="timer-count">{timeoutRemaining}s</div>
                    <div className="timer-text">Timeout remaining</div>
                  </div>
                )}
                
                {currentStep?.stepType === 'recording' && isRecording && (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px', 
                    background: '#fef3c7',
                    borderRadius: '4px',
                    border: '1px solid #f59e0b'
                  }}>
                    Recording in progress
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {recordingStatus && (
          <div className="recording-status" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {recordingStatus}
          </div>
        )}
        
        <div className="sequence-progress" style={{ 
          marginTop: '15px', 
          padding: '10px', 
          background: '#f8fafc',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div style={{ marginBottom: '5px', fontWeight: '600' }}>
            Progress: {currentStepIndex + 1} / {totalSteps} steps
          </div>
          <div style={{ 
            width: '100%', 
            height: '4px', 
            background: '#e2e8f0', 
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
              height: '100%',
              background: '#3b82f6',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
    );
  }

  // Subject mode rendering
  const currentStep = getCurrentStep();
  const totalSteps = sequenceConfig.steps.length;

  return (
    <div className="main-task-component">
      {/* Hidden audio elements for all steps */}
      {sequenceConfig.steps.map((step, idx) => (
        <audio key={idx} ref={el => audioRefs.current[`step_${idx}`] = el} style={{ display: 'none' }}>
          <source src={`${AUDIO_DIR}${step.file}`} type="audio/mpeg" />
        </audio>
      ))}

      <div className="procedure-header">
        <div className="procedure-title">
          <h2>VR Room Task</h2>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <ul>
            <li>Please put on the VR headset when instructed.</li>
            <li>Follow the audio instructions you hear in the headset.</li>
            <li>The task will guide you through different activities.</li>
            <li>Speak clearly when responding to questions.</li>
            <li>You will hear beeps to indicate when to start or stop certain activities.</li>
            <li>Wait for the experimenter if you have questions or concerns.</li>
          </ul>
        </div>

        <div className="task-interface">
          {currentStepIndex >= totalSteps ? (
            <div className="completion-message">
              <h3>VR Room Task Completed</h3>
              <p>Thank you for completing the VR room task.</p>
              <p>Please remove the headset and wait for the experimenter.</p>
            </div>
          ) : currentStepIndex === 0 && !isRecording && timeoutRemaining === 0 ? (
            <div className="waiting-section">
              <h3>Ready to Begin</h3>
              <p>The experimenter will start the task when you are ready.</p>
            </div>
          ) : (
            <>
              <div className="current-step-section">
                <h3>Step {currentStepIndex + 1} of {totalSteps}</h3>
                {currentStep && (
                  <div className="step-info">
                    <p>{currentStep.file.replace(/^\d+-[A-Z]+-/, '').replace(/_/g, ' ').replace('.mp3', '')}</p>
                  </div>
                )}
              </div>

              {timeoutRemaining > 0 && (
                <div className="observation-section">
                  <h3>Please Wait</h3>
                  <div className="observation-timer">
                    <div className="timer-display">{timeoutRemaining}</div>
                    <div className="timer-label">seconds remaining</div>
                  </div>
                </div>
              )}

              {currentStep?.stepType === 'recording' && isRecording && (
                <div className="recording-section">
                  <h3>Recording Your Response</h3>
                  <div className="recording-indicator">
                    <span className="recording-dot"></span>
                    <span>Recording in progress...</span>
                  </div>
                  <div className="recording-status">{recordingStatus}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="task-status">
        <div className="status-indicator">
          <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
          <span>
            {isRecording ? 'Recording in progress...' : 
             currentStepIndex >= totalSteps ? 'Task completed' :
             timeoutRemaining > 0 ? `Waiting (${timeoutRemaining}s)` :
             `Step ${currentStepIndex + 1} of ${totalSteps}`}
          </span>
        </div>
        <div className="progress-info">
          Progress: {Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%
        </div>
      </div>
    </div>
  );
};

export default VRRoomTaskComponent;