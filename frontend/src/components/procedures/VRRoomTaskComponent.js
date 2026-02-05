import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startRecording, playBeep, setCondition, setEventMarker } from '../utils/helpers.js';
import './MainTaskComponent.css'; // Reuse same styling

const VRRoomTaskComponent = ({ 
  audioSet = 'vr_room_task_1',
  procedure, 
  sessionId, 
  onTaskComplete, 
  isExperimenterMode = false,
  procedureActive = false
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

// Use ref to track current step index to avoid stale closure issues
  const currentStepIndexRef = useRef(0);
  // Ref to hold executeStepByIndex to break circular dependency
  const executeStepByIndexRef = useRef(null);

const actualAudioSet = procedure?.configuration?.['audio-set-selection']?.audioSet 
                    || procedure?.wizardData?.vrRoomAudioSet 
                    || selectedAudioSet;
const AUDIO_DIR = `/audio_files/vr_room_audio/${actualAudioSet}/`;

// Reset to step 0 when procedure instance changes
useEffect(() => {
  if (procedure?.instanceId && isExperimenterMode) {
    console.log(`VR Room Task procedure changed to instanceId: ${procedure.instanceId} - resetting to step 0`);
    setCurrentStepIndex(0);
    currentStepIndexRef.current = 0;
    setTimeoutRemaining(0);
    setRecordingStatus('');
    setIsRecording(false);
    
    // Clear any running timers
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
      beepTimeoutRef.current = null;
    }
    
    // Clear all audio handlers AND force reload
    Object.values(audioRefs.current).forEach(audioRef => {
      if (audioRef) {
        audioRef.onended = null;
        audioRef.pause();
        audioRef.currentTime = 0;
        audioRef.src = ''; // Clear the source
        audioRef.load(); // Force reload
      }
});

// Clear the refs object completely
audioRefs.current = {};
  }
}, [procedure?.instanceId, isExperimenterMode]);

  // Keep ref in sync with state
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // Load audio files and configuration
  useEffect(() => {
    const loadAudioFilesAndConfig = async () => {
      try {
        const audioSet = procedure?.configuration?.['audio-set-selection']?.audioSet || selectedAudioSet;
        const sessionType = procedure?.configuration?.['session-type-selection']?.sessionType || 'practice';
        
        // Check if we have an edited config from the wizard
        const wizardEditedConfig = procedure?.configuration?.['sequence-editor']?.editableConfig;
        
        let filteredSteps = [];
        
        if (wizardEditedConfig && wizardEditedConfig.steps) {
          // Use the edited config from the wizard
          console.log('=== VR ROOM TASK LOADING (WIZARD-EDITED) ===');
          console.log('Using wizard-edited configuration');
          console.log('Wizard config:', JSON.stringify(wizardEditedConfig, null, 2));
          
          // For wizard-edited configs, the steps should already be the filtered ones we need
          // relevantIndices was used during editing but the final steps array is what we use
          filteredSteps = wizardEditedConfig.steps || [];
          
          console.log(`Session type: ${sessionType}`);
          console.log(`Loaded ${filteredSteps.length} steps from wizard configuration`);
          console.log('Steps:', filteredSteps);
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
          
          const fullConfig = configData.config;
          
          // Filter steps based on session type for server-loaded config
          filteredSteps = fullConfig.steps.filter(step => {
            return step.sessionTypes && step.sessionTypes.includes(sessionType);
          });
          
          console.log(`Session type: ${sessionType}`);
          console.log(`Total steps in config: ${fullConfig.steps.length}`);
          console.log(`Filtered steps for this session: ${filteredSteps.length}`);
        }
        
        if (!filteredSteps || filteredSteps.length === 0) {
          console.error('No steps found in configuration!');
          setLoading(false);
          return;
        }
        
        console.log('Setting sequence config with steps:', filteredSteps);
        setSequenceConfig({ steps: filteredSteps });
        
        // Load audio files
        const audioFilesNeeded = filteredSteps
          .filter(step => step && step.file)
          .map(step => step.file);
        
        console.log('Audio files needed:', audioFilesNeeded);
        
        if (audioFilesNeeded.length === 0) {
          console.warn('No audio files needed - all steps may be timeouts or recordings');
          setAudioFiles([]);
          console.log('=== VR ROOM TASK LOADED SUCCESSFULLY (NO AUDIO FILES) ===');
          setLoading(false);
          return;
        }
        
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
        console.error('Error stack:', error.stack);
      } finally {
        setLoading(false);
      }
    };
    
    loadAudioFilesAndConfig();
  }, [selectedAudioSet, procedure]);

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

  const playAudio = useCallback((stepIndex, onEndedCallback) => {
    const ref = audioRefs.current[`step_${stepIndex}`];
    if (ref) {
      if (onEndedCallback) {
        ref.onended = onEndedCallback;
      }
      ref.play()
        .then(() => console.log(`Playing step ${stepIndex}`))
        .catch(err => console.error(`Error playing step ${stepIndex}:`, err));
    }
  }, []);

  const getCurrentStep = useCallback(() => {
    if (!sequenceConfig || !sequenceConfig.steps || currentStepIndex >= sequenceConfig.steps.length) {
      return null;
    }
    return sequenceConfig.steps[currentStepIndex];
  }, [sequenceConfig, currentStepIndex]);

  const handleTaskComplete = useCallback(async () => {
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
  }, [onTaskComplete]);

  const proceedToNextStep = useCallback((fromStepIndex) => {
  // SAFETY: Prevent if we're already beyond this step
  if (currentStepIndexRef.current > fromStepIndex) {
    console.log(`Already moved past step ${fromStepIndex}, skipping proceedToNextStep`);
    return;
  }
  
  const nextIndex = fromStepIndex + 1;
  
  console.log(`proceedToNextStep called from step ${fromStepIndex}, moving to step ${nextIndex}`);
  
  if (!sequenceConfig || !sequenceConfig.steps) {
    console.error('No sequence config available');
    return;
  }
  
  if (nextIndex < sequenceConfig.steps.length) {
    console.log(`Moving to step ${nextIndex + 1} of ${sequenceConfig.steps.length}`);
    
    // Clear ALL timers and intervals
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Clear ALL audio handlers
    Object.values(audioRefs.current).forEach(audioRef => {
      if (audioRef) {
        audioRef.onended = null;
        audioRef.pause();
        audioRef.currentTime = 0;
      }
    });
    
    // Update both state and ref
    setCurrentStepIndex(nextIndex);
    currentStepIndexRef.current = nextIndex;
    
    // Execute the next step after state update
    setTimeout(() => {
      if (executeStepByIndexRef.current) {
        executeStepByIndexRef.current(nextIndex);
      }
    }, 500);
  } else {
    console.log('All steps complete, task finished');
    handleTaskComplete();
  }
}, [sequenceConfig, handleTaskComplete]);

  const handleStepEnd = useCallback((stepIndex) => {
  return () => {
    const step = sequenceConfig?.steps?.[stepIndex];
    if (!step) {
      console.error(`handleStepEnd: No step found at index ${stepIndex}`);
      return;
    }

    // CRITICAL: Clear the audio handler immediately to prevent double-firing
    const audioRef = audioRefs.current[`step_${stepIndex}`];
    if (audioRef) {
      audioRef.onended = null;
    }

    console.log(`Step ${stepIndex} audio ended`);
    
    // Calculate total delay needed for beep + timeout
    let totalDelay = 0;
    
    // Add beep delay if configured
    if (step.beepAfter) {
      playBeep();
      totalDelay += 600; // 600ms for beep to complete
    }
    
    // Add timeout delay if configured
    if (step.timeout && step.timeout > 0) {
      totalDelay += step.timeout * 1000; // Convert seconds to milliseconds
    }
    
    // If there's any delay, handle it
    if (totalDelay > 0) {
      console.log(`Waiting ${totalDelay}ms (beep + timeout) after step ${stepIndex}`);
      
      // If there's a timeout, show countdown
      if (step.timeout && step.timeout > 0) {
        setTimeoutRemaining(step.timeout);
        setRecordingStatus(`Waiting ${step.timeout} seconds...`);
        
        let remaining = step.timeout;
        timeoutRef.current = setInterval(() => {
          remaining -= 1;
          setTimeoutRemaining(remaining);
          
          if (remaining <= 0) {
            clearInterval(timeoutRef.current);
            timeoutRef.current = null;
            setRecordingStatus('');
            setTimeoutRemaining(0);
          }
        }, 1000);
      }
      
      // Proceed after total delay
      setTimeout(() => {
        proceedToNextStep(stepIndex);
      }, totalDelay);
    } else {
      // No delay - proceed immediately
      proceedToNextStep(stepIndex);
    }
  };
}, [sequenceConfig, proceedToNextStep]);

  const startTimeoutForStep = useCallback((stepIndex) => {
  const step = sequenceConfig?.steps?.[stepIndex];
  if (!step) return;
  
  console.log(`Starting timeout for step ${stepIndex}: ${step.timeout} seconds`);
  
  setTimeoutRemaining(step.timeout);
  setRecordingStatus(`Waiting ${step.timeout} seconds...`);
  
  let remaining = step.timeout;
  timeoutRef.current = setInterval(() => {
    remaining -= 1;
    setTimeoutRemaining(remaining);
    
    if (remaining <= 0) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
      setRecordingStatus('');
      setTimeoutRemaining(0);
    }
  }, 1000);
  
  // Calculate delay: timeout + beepAfter if configured
  let totalDelay = step.timeout * 1000;
  
  if (step.beepAfter) {
    // Play beep at the END of timeout
    setTimeout(() => {
      playBeep();
    }, totalDelay);
    totalDelay += 600; // Add beep duration
  }
  
  // Proceed after timeout (and beep if configured)
  setTimeout(() => {
    proceedToNextStep(stepIndex);
  }, totalDelay);
}, [sequenceConfig, proceedToNextStep]);

  const stopRecordingForStep = useCallback((stepIndex) => {
    setIsRecording(false);
    console.log(`Stopping recording for step ${stepIndex + 1}`);
    
    const step = sequenceConfig?.steps?.[stepIndex];
    if (!step) {
      console.error(`stopRecordingForStep: No step found at index ${stepIndex}`);
      return;
    }
    
    // Handle beep after recording if configured
    if (step.beepAfter) {
      playBeep();
    }
    
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
    
    // Clear timeouts
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current);
      beepTimeoutRef.current = null;
    }
    
    // Proceed to next step, passing the current step index explicitly
    console.log(`Recording stopped at step ${stepIndex}, proceeding to next step`);
    proceedToNextStep(stepIndex);
  }, [sequenceConfig, eventMarker, condition, proceedToNextStep]);

  const startRecordingForStep = useCallback((stepIndex) => {
    const step = sequenceConfig?.steps?.[stepIndex];
    if (!step) {
      console.error(`startRecordingForStep: No step found at index ${stepIndex}`);
      return;
    }
    
    // Verify this is actually a recording step
    if (step.stepType !== 'recording') {
      console.error(`startRecordingForStep: Step ${stepIndex} is not a recording step (type: ${step.stepType})`);
      return;
    }
    
    setIsRecording(true);
    const recordingDuration = step.recordingDuration || 90;
    setRecordingStatus(`Recording started for step ${stepIndex + 1}... ${recordingDuration} second timer started.`);
    
    try {
      const emarker = `${eventMarker}_step_${stepIndex + 1}`;
      setEventMarker(emarker);
      startRecording();
      
      // Play beep before recording if configured
      if (step.beepBefore) {
        playBeep();
      }
      
      console.log(`Recording started for step ${stepIndex + 1}, duration: ${recordingDuration}s`);

      // Warning beeps at configured time (defaults to 15 seconds before end if not configured)
      const warningTime = step.warningBeepAt !== undefined 
        ? step.warningBeepAt 
        : Math.max(0, recordingDuration - 15);
      
      if (warningTime > 0 && warningTime < recordingDuration) {
        beepTimeoutRef.current = setTimeout(() => {
          console.log(`Warning beeps at ${warningTime}s`);
          playBeep();
          setTimeout(playBeep, 500);
        }, warningTime * 1000);
      }

      // Stop recording after duration - capture stepIndex in closure
      const capturedStepIndex = stepIndex;
      recordingTimeoutRef.current = setTimeout(() => {
        console.log(`Recording timeout reached for step ${capturedStepIndex}`);
        stopRecordingForStep(capturedStepIndex);
      }, recordingDuration * 1000);
      
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingStatus(`Recording failed: ${error.message}`);
      setIsRecording(false);
    }
  }, [sequenceConfig, eventMarker, stopRecordingForStep]);

  const executeStepByIndex = useCallback((stepIndex) => {
  if (!sequenceConfig || !sequenceConfig.steps) {
    console.error('executeStepByIndex: No sequence config');
    return;
  }
  
  const step = sequenceConfig.steps[stepIndex];
  if (!step) {
    console.error(`executeStepByIndex: No step at index ${stepIndex}`);
    return;
  }
  
  console.log(`Executing step ${stepIndex + 1}/${sequenceConfig.steps.length}:`, step);
  
  // Determine step type - prioritize explicit stepType, then check for file
  const hasFile = step.file && step.file.trim() !== '';
  const isRecordingStep = step.stepType === 'recording';
  const isTimeoutStep = step.stepType === 'timeout' || (!hasFile && !isRecordingStep && step.timeout && step.timeout > 0);
  
  console.log(`Step ${stepIndex} analysis: hasFile=${hasFile}, isRecordingStep=${isRecordingStep}, isTimeoutStep=${isTimeoutStep}`);
  
  // Handle beep before if configured (but NOT for recording steps - they handle their own beep)
  const shouldPlayBeepBefore = step.beepBefore && step.stepType !== 'recording';
  
  // FIXED: Increase delay to ensure beep completes
  const delay = shouldPlayBeepBefore ? 800 : 0;  // Changed from 300 to 800ms
  
  if (shouldPlayBeepBefore) {
    console.log(`Playing beep before step ${stepIndex}`);
    playBeep();
  }
  
  // Execute the step action after optional beep delay
  setTimeout(() => {
    if (hasFile) {
      // Audio file step
      console.log(`Step ${stepIndex}: Playing audio file ${step.file}`);
      playAudio(stepIndex, handleStepEnd(stepIndex));
    } else if (isRecordingStep) {
      // Recording step - ONLY identified by stepType === 'recording'
      console.log(`Step ${stepIndex}: Starting recording session`);
      startRecordingForStep(stepIndex);
    } else if (isTimeoutStep) {
      // Timeout step
      console.log(`Step ${stepIndex}: Starting timeout of ${step.timeout}s`);
      startTimeoutForStep(stepIndex);
    } else {
      // No action defined - skip to next
      console.warn(`Step ${stepIndex} has no action (no file, not recording, no timeout) - skipping`);
      proceedToNextStep(stepIndex);
    }
  }, delay);
}, [sequenceConfig, playAudio, handleStepEnd, startRecordingForStep, startTimeoutForStep, proceedToNextStep]);

  // Keep ref updated for use in proceedToNextStep
  executeStepByIndexRef.current = executeStepByIndex;
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
          {sequenceConfig.steps.map((step, idx) => (
            <div 
              key={idx}
              className="current-step-control" 
              style={{ display: currentStepIndex === idx ? 'block' : 'none' }}
            >
              <label>Step {idx + 1}/{sequenceConfig.steps.length}: {step.file || (step.stepType === 'recording' ? 'Recording' : 'Timeout')}</label>
              {step.file && (
                <audio 
                  key={`${procedure.instanceId}_step_${idx}`}
                  ref={el => audioRefs.current[`step_${idx}`] = el}
                  controls
                  onEnded={handleStepEnd(idx)}
                  className="audio-control"
                  style={{ width: '100%', marginBottom: '10px' }}
                >
                  <source src={`${AUDIO_DIR}${step.file}`} type="audio/mpeg" />
                </audio>
              )}
              
              {!step.file && step.stepType !== 'recording' && step.timeout > 0 && timeoutRemaining > 0 && currentStepIndex === idx && (
                <div className="observation-timer-display" style={{ marginTop: '10px' }}>
                  <div className="timer-count">{timeoutRemaining}s</div>
                  <div className="timer-text">Timeout remaining</div>
                </div>
              )}
              
              {step.stepType === 'recording' && isRecording && currentStepIndex === idx && (
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
          ))}

          {currentStepIndex >= totalSteps && (
            <div className="completion-control">
              <label>Task Completed</label>
              <div className="completion-display">
                VR room task sequence completed successfully.
              </div>
            </div>
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
            Progress: {Math.min(currentStepIndex + 1, totalSteps)} / {totalSteps} steps
          </div>
          <div style={{ 
            width: '100%', 
            height: '4px', 
            background: '#e2e8f0', 
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(Math.min(currentStepIndex + 1, totalSteps) / totalSteps) * 100}%`,
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
        step.file && (
          <audio key={`${procedure.instanceId}_step_${idx}`} ref={el => audioRefs.current[`step_${idx}`] = el} style={{ display: 'none' }}>
            <source src={`${AUDIO_DIR}${step.file}`} type="audio/mpeg" />
          </audio>
        )
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
                {currentStep && currentStep.file && (
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
          Progress: {Math.round((Math.min(currentStepIndex + 1, totalSteps) / totalSteps) * 100)}%
        </div>
      </div>
    </div>
  );
};

export default VRRoomTaskComponent;