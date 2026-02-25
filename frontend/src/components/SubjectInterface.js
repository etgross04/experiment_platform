/**
 * SubjectInterface Component - Participant-Facing Experiment Interface
 * 
 * @component SubjectInterface
 * @description Main interface for experiment participants, handling consent, participant
 * registration, procedure execution, and real-time synchronization with experimenter interface.
 * Displays experimental procedures and collects participant responses.
 * 
 * @state
 * @property {boolean} consentMode - Whether in standalone consent form mode
 * @property {boolean} consentCompleted - Whether consent has been completed
 * @property {Ref} procedureComponentRef - Reference to current procedure component
 * @property {string} currentTask - Current task state ('waiting'|'active'|'completed'|'audio_test')
 * @property {string|null} sessionId - Active session ID from URL parameters
 * @property {Procedure|null} currentProcedure - Currently active procedure object
 * @property {Object|null} experimentData - Loaded experiment configuration
 * @property {boolean} showForm - Whether to show participant registration form
 * @property {Object} formData - Participant registration form data
 * @property {Object} formErrors - Form validation errors
 * @property {boolean} emailsMatch - Whether email and emailConfirm fields match
 * @property {number} currentProcedureIndex - Index of current procedure in experiment
 * @property {boolean} showAudioTest - Whether to show audio test interface
 * @property {boolean} sessionTerminated - Whether session has been closed by experimenter
 * @property {boolean} restoredState - Whether session state was restored from server
 * @property {boolean} experimentCompleteForSubject - Whether all procedures completed
 * @property {Ref} currentProcedureIndexRef - Ref to current procedure index for SSE callbacks
 * 
 * @typedef {Object} FormData
 * @property {string} firstName - Participant first name
 * @property {string} lastName - Participant last name
 * @property {string} email - Participant email address
 * @property {string} emailConfirm - Email confirmation
 * @property {string} pid - Participant ID (optional)
 * @property {string} sonaClass - SONA class for credit assignment (optional)
 * 
 * @typedef {Object} Procedure
 * @property {string} id - Procedure type identifier
 * @property {string} name - Procedure display name
 * @property {string} instanceId - Unique instance identifier
 * @property {Object} configuration - Procedure-specific configuration
 * @property {Object} wizardData - Legacy wizard configuration
 * @property {string} [platform] - External platform name
 * 
 * @api_endpoints
 * 
 * Session Management:
 * GET /api/sessions/{sessionId}/check-active
 * @returns {{success: boolean, active: boolean, current_procedure?: number, completed_procedures?: Array<number>}}
 * @description Checks session status and retrieves current state (polled every 30 seconds)
 * 
 * GET /api/sessions/{sessionId}/stream
 * @description Server-Sent Events stream for real-time updates
 * SSE Events:
 * - procedure_changed: {event_type, session_id, current_procedure}
 * - audio_test_started: {event_type, session_id}
 * - experiment_completed: {event_type, session_id}
 * 
 * POST /api/sessions/{sessionId}/participant
 * @body {participantInfo: FormData, timestamp: string}
 * @description Saves participant registration information
 * 
 * POST /api/sessions/{sessionId}/complete-procedure
 * @body {completed: boolean, task_type?: string, timestamp: string}
 * @description Marks current procedure as complete
 * 
 * Audio Testing:
 * POST /test_audio
 * @returns {{result: string}}
 * @description Tests audio recording and returns transcription
 * Uses startRecording() from utils/helpers.js
 * 
 * Experiment Data:
 * GET /api/experiments/{experimentId}
 * @returns {Experiment} Experiment configuration with procedures
 * @description Loads experiment design (experimentId extracted from sessionId)
 * 
 * @functions
 * 
 * @function isExperimentCompleteForSubject
 * @returns {boolean} Whether all non-config procedures completed
 * @description Filters out consent/data-collection, checks if current index past last procedure
 * 
 * @function loadExperimentData
 * @async
 * @param {string} sessionId - Session ID
 * @description Extracts experiment ID from session, loads experiment data, sets first procedure
 * Session ID format: {experimentId}_{timestamp}_{random}
 * 
 * @function handleInputChange
 * @param {Event} e - Input change event
 * @description Updates form data, validates email matching, clears field errors
 * 
 * @function validateForm
 * @returns {Object} Validation errors object
 * @description Validates registration form:
 * - firstName, lastName required
 * - email required and valid format
 * - emailConfirm required and matches email
 * - pid, sonaClass optional
 * 
 * @function handleFormSubmit
 * @async
 * @param {Event} e - Form submit event
 * @description Validates and submits participant registration
 * 
 * @function handleConsentComplete
 * @async
 * @description Completes consent procedure:
 * 1. Calls procedure-specific completion (if ref exists)
 * 2. Records completion via API
 * 3. Updates state to show registration form
 * 
 * @function handleTaskComplete
 * @async
 * @description Completes current procedure:
 * 1. Calls procedure-specific completion (if ref exists)
 * 2. Records completion via API
 * 3. Sets event marker to 'subject_idle'
 * 4. Shows completion message, then returns to waiting
 * 
 * @function handleAudioTestComplete
 * @description Hides audio test, returns to waiting state
 * 
 * @function isPsychoPyTask
 * @param {Procedure} procedure - Procedure object
 * @returns {boolean} Whether procedure uses external platform
 * @description Checks configuration['psychopy-setup'].usePsychoPy or wizardData.usePsychoPy
 * 
 * @function getProcedureComponent
 * @param {string} procedureName - Procedure name
 * @param {Object} procedureConfig - Procedure configuration
 * @param {string} procedureId - Procedure ID
 * @param {Procedure} procedure - Full procedure object
 * @returns {React.Component|null} Procedure component or null
 * @description Maps procedure to React component:
 * - External platform → PsychoPyTransitionComponent
 * - Mental Arithmetic Task stressor → MATComponent
 * - By ID: consent, ser-baseline, break, demographics, biometric-baseline
 * - By name: consent, mat, survey, ser baseline, break, demographics, biometric baseline
 * 
 * @function renderParticipantForm
 * @returns {JSX.Element} Registration form or termination screen
 * @description Renders participant info form with validation
 * 
 * @function renderProcedureContainer
 * @returns {JSX.Element} Current procedure component with header/actions
 * @description Wraps procedure component with step counter and complete button
 * 
 * @function renderCurrentTask
 * @returns {JSX.Element} Current task view based on state
 * @description Routes to appropriate view:
 * - showAudioTest → AudioTestComponent
 * - PRS/Main Task/VR Room Task → Experimenter-assisted waiting screen
 * - active → Procedure container (with restoration notice if applicable)
 * - completed → Completion message
 * - waiting → Waiting screen
 * 
 * @lifecycle
 * 
 * Initialization:
 * 1. Extracts session ID and mode from URL (?session={id}&mode={mode})
 * 2. If mode=consent, enters standalone consent mode
 * 3. Loads experiment data from session ID
 * 4. Establishes SSE connection for real-time updates
 * 5. Starts session activity polling (30-second interval)
 * 
 * Consent Mode Flow:
 * 1. URL parameter mode=consent detected
 * 2. Shows standalone consent form
 * 3. On completion, records and shows registration form
 * 
 * Normal Flow:
 * 1. Show participant registration form
 * 2. Submit participant info
 * 3. Wait for experimenter to start procedures
 * 4. Execute procedures via SSE updates
 * 5. Complete procedures and wait for next
 * 
 * Session State Restoration:
 * - Polls /check-active every 30 seconds
 * - Restores current_procedure if different from local state
 * - Shows restoration notice on UI
 * - Only restores if experiment not complete for subject
 * 
 * Cleanup:
 * - Warns before unload (progress saved message)
 * - Closes SSE connection
 * - Clears polling interval
 * - On experiment completion, closes window after 2-second delay
 * 
 * @sse_events
 * 
 * procedure_changed:
 * - Updates currentProcedureIndex
 * - Loads new procedure
 * - Sets currentTask to 'active'
 * 
 * audio_test_started:
 * - Shows audio test interface
 * - Sets currentTask to 'audio_test'
 * 
 * experiment_completed:
 * - Closes SSE connection
 * - Displays completion message
 * - Attempts to close window after 2 seconds
 * - Falls back to manual close instruction
 * 
 * @subcomponents
 * 
 * @component AudioTestComponent
 * @description Pre-test audio system verification
 * @props {string} sessionId, {Function} onComplete
 * Flow:
 * 1. Shows instructions ("She sells seashells...")
 * 2. Start/stop recording buttons
 * 3. Displays transcription
 * 4. Complete button sends result to server
 * 
 * Procedure Components (dynamically loaded):
 * - ConsentForm
 * - MATComponent (Mental Arithmetic Task)
 * - PsychoPyTransitionComponent
 * - SurveyComponent
 * - SERBaselineComponent
 * - BreakComponent
 * - DemographicsSurveyComponent
 * - BiometricBaselineComponent
 * 
 * @procedure_ref
 * procedureComponentRef allows calling procedure-specific completion handlers:
 * - ConsentForm: Validates consent agreement
 * - Other components: Custom validation/cleanup
 * Called before generic completion in handleTaskComplete/handleConsentComplete
 * 
 * @special_procedures
 * 
 * PRS, Main Task, VR Room Task:
 * - Not rendered in subject interface
 * - Shows "experimenter will assist" waiting screen
 * - Controlled via experimenter's tool panel
 * - Completion triggered from experimenter interface
 * 
 * External Platform Procedures (PsychoPy, etc.):
 * - Shows PsychoPyTransitionComponent
 * - Displays platform name and instructions
 * - Experimenter launches external software
 * - Subject completes when external task done
 * 
 * @behavior
 * 
 * Email Validation:
 * - Real-time matching check on both email fields
 * - Shows warning if mismatch
 * - Shows success checkmark if match
 * - Prevents submission if mismatch
 * 
 * Session Termination:
 * - Detected via /check-active endpoint
 * - Shows termination screen
 * - Prevents further interaction
 * - User instructed to close window
 * 
 * Experiment Completion:
 * - Detected when currentProcedureIndex > last procedure
 * - Stops session polling
 * - Waits for experiment_completed SSE event
 * - Shows thank you message
 * - Auto-closes window (with fallback)
 * 
 * State Restoration:
 * - Occurs when returning to existing session
 * - Restores current procedure from server
 * - Shows green restoration notice
 * - Allows continuing from where participant left off
 * 
 * @window_management
 * - beforeunload warning: "Progress saved, can return"
 * - Auto-close on completion (2-second delay)
 * - Fallback manual close instruction
 * - Separate consent window (mode=consent)
 * 
 * @notes
 * - Session ID format: {experimentId}_{timestamp}_{random}
 * - Consent can be standalone (mode=consent) or part of experiment
 * - Participant registration required before procedure execution
 * - PRS/Main Task/VR Room Task delegated to experimenter control
 * - Audio test can be triggered mid-experiment via SSE
 * - Form state persisted across procedure changes
 * - Email confirmation prevents typos in contact info
 * - PID and SONA class are optional fields
 * - Procedure components receive ref for custom completion handlers
 * - Platform name passed to PsychoPyTransitionComponent from config
 * - Session polling stops when experiment complete to prevent unnecessary requests
 * - currentProcedureIndex uses ref to avoid stale closure in SSE callback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SubjectInterface.css';
import { startRecording, setEventMarker } from './utils/helpers';
import MATComponent from './procedures/MATComponent';
import ConsentForm from './procedures/ConsentForm';
import PsychoPyTransitionComponent from './procedures/PsychoPyTransitionComponent';
import SurveyComponent from './procedures/SurveyComponent';
import SERBaselineComponent from './procedures/SERBaselineComponent';
import BreakComponent from './procedures/BreakComponent';
import DemographicsSurveyComponent from './procedures/DemographicsSurveyComponent';
import BiometricBaselineComponent from './procedures/BiometricBaselineComponent';

function AudioTestComponent({ sessionId, onComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  const handleStartRecording = async () => {
    try {
      await startRecording();
      setIsRecording(true);
      console.log('Recording started for audio test');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error starting recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      
      const response = await fetch('/test_audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setTranscription(data.result || 'Unable to transcribe audio');
        setShowResult(true);
      } else {
        console.error('Error testing audio:', data.message);
        setTranscription('Error processing audio');
        setShowResult(true);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setTranscription('Error processing audio');
      setShowResult(true);
    }
  };

  const handleTaskComplete = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/complete-procedure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: true,
          task_type: 'audio_test',
          transcription: transcription,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setTestCompleted(true);
        onComplete();
      } else {
        console.error('Error completing audio test');
        alert('Error completing audio test. Please try again.');
      }
    } catch (error) {
      console.error('Error completing audio test:', error);
      alert('Error completing audio test. Please try again.');
    }
  };

  if (testCompleted) {
    return (
      <div className="completion-message">
        <div className="completion-icon">✅</div>
        <h2>Audio Test Completed!</h2>
        <p>Thank you for completing the audio test.</p>
        <p>Please wait for the experimenter to continue.</p>
      </div>
    );
  }

  return (
    <div className="procedure-task-container">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>Audio System Test</h2>
          <h3>Pre-test Audio Check</h3>
        </div>
      </div>

      <div className="procedure-content">
        {(
          <div className="task-instructions">
            <h4>Instructions</h4>
            <p>Please press the button and say: <strong>"She sells seashells by the sea shore"</strong></p>
            <p>Speak clearly and at a normal volume.</p>
          </div>
        )}

        <div className="task-interface">
          <div className="task-area audio-task-area">
            <div className="stimulus-display">
              <div className="stimulus-content">
                {!showResult ? (
                  <div className="audio-test-controls">
                    <button
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      className={`response-btn ${isRecording ? 'stop-recording' : 'start-recording'}`}
                      disabled={false}
                    >
                      {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
                    </button>
                    {isRecording && (
                      <div className="recording-indicator">
                        <span className="recording-dot"></span>
                        Recording in progress...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="test-complete-area">
                    <div className="transcription-display">
                      <p className="transcription-text">{transcription}</p>
                    </div>
                    <button
                      onClick={handleTaskComplete}
                      className="response-btn primary"
                    >
                      ✅ Task Complete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectInterface() {
  const [consentMode, setConsentMode] = useState(false);
  const [consentCompleted, setConsentCompleted] = useState(false);
  const procedureComponentRef = useRef(null);
  const [currentTask, setCurrentTask] = useState('waiting');
  const [sessionId, setSessionId] = useState(null);
  const [currentProcedure, setCurrentProcedure] = useState(null);
  const [experimentData, setExperimentData] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailConfirm: '',
    pid: '',
    sonaClass: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [emailsMatch, setEmailsMatch] = useState(true);
  const [currentProcedureIndex, setCurrentProcedureIndex] = useState(0);
  const [showAudioTest, setShowAudioTest] = useState(false);

  // Cleanup states
  const [sessionTerminated, setSessionTerminated] = useState(false);
  const [restoredState, setRestoredState] = useState(false);
  const [experimentCompleteForSubject, setExperimentCompleteForSubject] = useState(false);
  const currentProcedureIndexRef = useRef(currentProcedureIndex);

  const isExperimentCompleteForSubject = useCallback(() => {
    if (!experimentData || !experimentData.procedures) return false;
    
    const filteredProcedures = experimentData.procedures.filter(
      procedure => procedure.id !== 'consent' && 
                  procedure.id !== 'data-collection' && 
                  !procedure.name?.toLowerCase().includes('consent')
    );
    
    if (filteredProcedures.length === 0) return false;
    
    const lastProcedureIndex = experimentData.procedures.findIndex(
      proc => proc === filteredProcedures[filteredProcedures.length - 1]
    );
    
    return currentProcedureIndex > lastProcedureIndex;
  }, [experimentData, currentProcedureIndex]);

  useEffect(() => {
    currentProcedureIndexRef.current = currentProcedureIndex;
  }, [currentProcedureIndex]);

  useEffect(() => {
    if (!sessionId || consentMode) return;

    if (isExperimentCompleteForSubject()) {
      setExperimentCompleteForSubject(true);
      setCurrentTask('completed');
      console.log('Experiment complete for subject - stopping session checks');
      return; 
    }
    
    const checkSessionActive = async () => {
      if (experimentCompleteForSubject) {
        return;
      }
      
      try {
        const response = await fetch(`/api/sessions/${sessionId}/check-active`);
        const data = await response.json();
        
        if (!data.success) {
          console.error('Error checking session status');
          return;
        }
        
        if (!data.active) {
          setSessionTerminated(true);
          setShowForm(false);
          alert('This experiment session has been closed by the experimenter.');
          return;
        }
        
        // Only restore state if experiment is not complete for subject
        if (data.current_procedure !== undefined && 
          data.current_procedure !== currentProcedureIndexRef.current && // <-- Use ref here
            !isExperimentCompleteForSubject()) {
          console.log('Restoring session state:', {
            current_procedure: data.current_procedure,
            completed_procedures: data.completed_procedures
          });
          setCurrentProcedureIndex(data.current_procedure);
          
          if (experimentData && experimentData.procedures && experimentData.procedures[data.current_procedure]) {
            setCurrentProcedure(experimentData.procedures[data.current_procedure]);
            setCurrentTask('active');
          }
          
          setRestoredState(true);
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    };
    
    checkSessionActive();

    const checkInterval = setInterval(checkSessionActive, 30000);
    
    return () => clearInterval(checkInterval);
  }, [sessionId, experimentData, consentMode, experimentCompleteForSubject, isExperimentCompleteForSubject]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session');
    const mode = urlParams.get('mode');
    if (session) {
      setSessionId(session);
      loadExperimentData(session);
    }

    if (mode === 'consent') {
      setConsentMode(true);
      setShowForm(false); 
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    console.log('Subject: Creating SSE connection for:', sessionId);
    
    const eventSource = new EventSource(`http://localhost:5001/api/sessions/${sessionId}/stream`);
    
    eventSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      console.log("Subject: Update received:", data);
      
      if (data.event_type === 'procedure_changed' && data.session_id === sessionId) {
        console.log("Subject: Procedure changed to:", data.current_procedure);
        setCurrentProcedureIndex(data.current_procedure);
        
        if (experimentData && experimentData.procedures && experimentData.procedures[data.current_procedure]) {
          setCurrentProcedure(experimentData.procedures[data.current_procedure]);
          setCurrentTask('active'); 
        }
      }

      if (data.event_type === 'audio_test_started' && data.session_id === sessionId) {
        console.log("Subject: Audio test started");
        setShowAudioTest(true);
        setCurrentTask('audio_test');
      }

      if (data.event_type === 'experiment_completed' && data.session_id === sessionId) {
        console.log("Subject: Experiment completed, closing window");
        eventSource.close();
        
        document.body.innerHTML = '<div style="text-align:center;padding:50px;font-family:sans-serif;"><h2>Experiment Complete</h2><p>Thank you for participating!</p><p>This window will close automatically...</p></div>';
        
        setTimeout(() => {
          window.close();
          setTimeout(() => {
            document.body.innerHTML = '<div style="text-align:center;padding:50px;font-family:sans-serif;"><h2>Experiment Complete</h2><p>Thank you for participating!</p><p>You can now close this window.</p></div>';
          }, 1000);
        }, 2000);
      }
    };
    
    eventSource.onerror = function(event) {
      console.error("Subject: SSE Error:", event);
    };

    return () => eventSource.close();
  }, [sessionId, experimentData]);

  useEffect(() => {
    if (!sessionId || showForm) return;

    const handleBeforeUnload = (event) => {
      const message = 'Your progress will be saved. You can return to this link to continue.';
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, showForm]);

  const handleConsentComplete = async () => {
    if (procedureComponentRef.current?.handleProcedureComplete) {
      try {
        await procedureComponentRef.current.handleProcedureComplete();
      } catch (error) {
        console.error('Consent validation failed:', error);
        
        return;
      }
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/complete-procedure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: true,
          task_type: 'consent',
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('Consent completion recorded');
        setConsentCompleted(true);
        setConsentMode(false);
        setShowForm(true);
      } else {
        console.error('Error completing consent');
        alert('Error completing consent. Please try again.');
      }
    } catch (error) {
      console.error('Error completing consent:', error);
      alert('Error completing consent. Please try again.');
    }
  };

  const getConsentProcedure = () => {
    if (!experimentData?.procedures) return null;
    return experimentData.procedures.find(proc => 
      proc.id === 'consent' || proc.name?.toLowerCase().includes('consent')
    );
  };

  const loadExperimentData = async (sessionId) => {
    try {
      const parts = sessionId.split('_');
      const experimentId = parts.slice(0, -2).join('_');
      
      const response = await fetch(`/api/experiments/${experimentId}`);
      if (response.ok) {
        const data = await response.json();
        setExperimentData(data);
        
        if (data.procedures && data.procedures.length > 0) {
          setCurrentProcedure(data.procedures[0]);
          setCurrentProcedureIndex(0);
        }
      } else {
        console.error('Failed to load experiment data');
      }
    } catch (error) {
      console.error('Error loading experiment data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };
    setFormData(newFormData);
    
    if (name === 'email' || name === 'emailConfirm') {
      const email = name === 'email' ? value : newFormData.email;
      const emailConfirm = name === 'emailConfirm' ? value : newFormData.emailConfirm;
      
      if (email && emailConfirm) {
        setEmailsMatch(email === emailConfirm);
      } else {
        setEmailsMatch(true); 
      }
    }
    
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.emailConfirm.trim()) {
      errors.emailConfirm = 'Please confirm your email';
    } else if (formData.email !== formData.emailConfirm) {
      errors.emailConfirm = 'Emails do not match';
    }
    
    return errors;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/participant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantInfo: formData,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('Participant information saved');
        setShowForm(false);
        setCurrentTask('waiting');
      } else {
        console.error('Error saving participant information');
        alert('Error saving participant information. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };

  const handleTaskComplete = async () => {
    if (procedureComponentRef.current?.handleProcedureComplete) {
      try {
        await procedureComponentRef.current.handleProcedureComplete();
      } catch (error) {
        console.error('Error in procedure-specific completion:', error);
        alert('Error completing procedure. Please try again.');
        return;
      }
    }
    try {
      const response = await fetch(`/api/sessions/${sessionId}/complete-procedure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: true,
          timestamp: new Date().toISOString()
        })
      });
      
      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);
      
      if (response.ok) {
        console.log('Task completion recorded');
        setCurrentTask('completed');
        setTimeout(() => {
          setCurrentTask('waiting'); 
        }, 2000);
      } else {
        console.error('Server error:', result);
      }
    } catch (error) {
      console.error('Error recording task completion:', error);
    }
    setEventMarker('subject_idle');
  };

  const handleAudioTestComplete = () => {
    setShowAudioTest(false);
    setCurrentTask('waiting');
  };

  const isPsychoPyTask = (procedure) => {
    if (procedure.configuration?.['psychopy-setup']?.usePsychoPy) {
      return true;
    }
    
    if (procedure.wizardData?.usePsychoPy) {
      return true;
    }

    const platform = procedure.configuration?.['psychopy-setup']?.platform ||
                     procedure.wizardData?.platform ||
                     procedure.platform;
    if (platform && platform.toLowerCase() === 'psychopy') {
      return true;
    }
    
    return false;
  };

  const getProcedureComponent = (procedureName, procedureConfig, procedureId, procedure) => {
    if (isPsychoPyTask(procedure)) {
      return PsychoPyTransitionComponent;
    }
    
    const name = procedureName?.toLowerCase();
    const config = procedureConfig || {};
    
    if (config['stressor-type']?.stressorType === 'Mental Arithmetic Task') {
      return MATComponent;
    }
    
    switch (procedureId) {
      case 'consent':
        return ConsentForm;
      case 'ser-baseline':
        return SERBaselineComponent;
      case 'break':
        return BreakComponent;
      case 'demographics':  
        return DemographicsSurveyComponent;
         case 'baseline-recording':
      case 'biometric-baseline':
        return BiometricBaselineComponent;
      default:
        switch (name) {
          case 'consent form':
          case 'consent':
          case 'informed consent':
            return ConsentForm;
          case 'mat':
          case 'mental arithmetic task':
          case 'math task':
          case 'stress induction':
            return MATComponent;
          case 'custom survey':
          case 'survey':
            return SurveyComponent;
          case 'ser baseline recording':  
          case 'ser baseline':
          case 'speech emotion recognition':
            return SERBaselineComponent;
          case 'break':  
            return BreakComponent;
          case 'demographics survey':  
          case 'demographics':
            return DemographicsSurveyComponent;
            case 'biometric baseline recording':
          case 'baseline recording':
          case 'biometric baseline':
            return BiometricBaselineComponent;

          default:
            return null;
        }
    }
  };

  const renderParticipantForm = () => {
    if (sessionTerminated) {
      return (
        <div className="subject-interface">
          <div className="session-terminated-screen">
            <div className="termination-icon">⚠️</div>
            <h2>Session Ended</h2>
            <p>This experiment session has been closed by the experimenter.</p>
            <p>Thank you for your participation.</p>
            <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
              You can now close this window.
            </p>
          </div>
        </div>
      );
    }  
    return (
      
      <div className="participant-form-container">
        <div className="form-header">
          <h2>Participant Information</h2>
          <p>Please fill out the following information before beginning the experiment.</p>
        </div>
        
        <form onSubmit={handleFormSubmit} className="participant-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={formErrors.firstName ? 'error' : ''}
              />
              {formErrors.firstName && <span className="error-text">{formErrors.firstName}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={formErrors.lastName ? 'error' : ''}
              />
              {formErrors.lastName && <span className="error-text">{formErrors.lastName}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={formErrors.email ? 'error' : ''}
            />
            {formErrors.email && <span className="error-text">{formErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="emailConfirm">Confirm Email Address *</label>
            <input
              type="email"
              id="emailConfirm"
              name="emailConfirm"
              value={formData.emailConfirm}
              onChange={handleInputChange}
              className={formErrors.emailConfirm ? 'error' : ''}
            />
            {formErrors.emailConfirm && <span className="error-text">{formErrors.emailConfirm}</span>}
            {formData.email && formData.emailConfirm && !emailsMatch && (
              <div className="email-mismatch-warning">
                ⚠️ Emails do not match
              </div>
            )}
            {formData.email && formData.emailConfirm && emailsMatch && (
              <div className="email-match-success">
                ✅ Emails match
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="pid">PID</label>
            <input
              type="text"
              id="pid"
              name="pid"
              value={formData.pid}
              onChange={handleInputChange}
              className={formErrors.pid ? 'error' : ''}
              placeholder="Enter your participant ID (optional)"
            />
            {formErrors.pid && <span className="error-text">{formErrors.pid}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sonaClass">Class you will assign SONA credit to</label>
            <input
              type="text"
              id="sonaClass"
              name="sonaClass"
              value={formData.sonaClass}
              onChange={handleInputChange}
              className={formErrors.sonaClass ? 'error' : ''}
              placeholder="(optional)"
            />
            {formErrors.sonaClass && <span className="error-text">{formErrors.sonaClass}</span>}
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn">
              Begin Experiment
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderProcedureContainer = () => {
    if (!currentProcedure) {
      return (
        <div className="task-loading">
          <h3>Loading procedure...</h3>
          <div className="loading-spinner">⏳</div>
        </div>
      );
    }

    const ProcedureComponent = getProcedureComponent(
      currentProcedure.name, 
      currentProcedure.configuration,
      currentProcedure.id,
      currentProcedure
    );

    const getQuestionSet = () => {
      return undefined;
    };

    return (
      <div className="procedure-container">
        <div className="procedure-header">
          <h3>Step {currentProcedureIndex} of { experimentData?.procedures?.length-1 || 0 }</h3>
        </div>
        <div className="procedure-content">
          {ProcedureComponent ? (
            <ProcedureComponent
              key={currentProcedure?.instanceId}
              procedure={{
                ...currentProcedure,
                platform: currentProcedure.configuration?.['psychopy-setup']?.platform || 
                          currentProcedure.wizardData?.platform || 
                          currentProcedure.platform || 
                          'PsychoPy'
              }}
              sessionId={sessionId}
              onTaskComplete={handleTaskComplete}
              ref={procedureComponentRef}
              questionSet={getQuestionSet()}
            />
          ) : (
            <div className="procedure-not-found">
              <h4>Procedure Not Found</h4>
              <p>The procedure "{currentProcedure.name}" is not implemented yet.</p>
              <p>Available procedures: Consent Form, MAT, VR Room Task, SART, Survey, Stroop (PsychoPy)</p>
              <p>Configuration: {JSON.stringify(currentProcedure.configuration)}</p>
              <button onClick={handleTaskComplete} className="task-complete-btn">
                Skip This Procedure
              </button>
            </div>
          )}
        </div>
        <div className="procedure-actions">
          <button onClick={handleTaskComplete} className="task-complete-btn">
            ✅ Complete Task
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentTask = () => {
    if (showAudioTest) {
      return (
        <AudioTestComponent 
          sessionId={sessionId} 
          onComplete={handleAudioTestComplete}
        />
      );
    }

    if (currentProcedure && (currentProcedure.id === 'prs' || currentProcedure.id === 'main-task' || currentProcedure.id === 'vr-room-task')) {
      return (
        <div className="waiting-screen">
          <h2>The experiment supervisor will now assist you with the next procedure.</h2>
          <div className="loading-indicator">⏳</div>
        </div>
      );
    }

    const wrapWithRestorationNotice = (content) => {
      if (restoredState && currentTask === 'active') {
        return (
          <>
            <div className="restoration-notice" style={{
              padding: '10px',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '4px',
              marginBottom: '10px',
              textAlign: 'center'
            }}>
              Session restored - continuing from where you left off
            </div>
            {content}
          </>
        );
      }
      return content;
    };

    switch(currentTask) {
      case 'active':
        return wrapWithRestorationNotice(renderProcedureContainer());
      case 'completed':
        return (
          <div className="completion-message">
            <div className="completion-icon">✅</div>
            <h2>Task Completed!</h2>
            <p>Thank you for completing this procedure.</p>
            <p>Waiting for next procedure...</p>
          </div>
        );
      case 'waiting':
        return (
          <div className="waiting-screen">
            <h2>Please wait for the experimenter to begin</h2>
            <div className="loading-indicator">⏳</div>
          </div>
        );
      default:
        return <div>Unknown task state</div>;
    }
  };

  return (
    <div className="subject-interface">
      {consentMode && !consentCompleted ? (
      <div className="procedure-task-container">
        <div className="procedure-header">
          <div className="procedure-title">
            <h2>Informed Consent</h2>
            <h3>Please review and agree to participate</h3>
          </div>
        </div>
        <div className="procedure-content">
          <ConsentForm 
            procedure={getConsentProcedure()}
            sessionId={sessionId}
            onTaskComplete={handleConsentComplete} 
            ref={procedureComponentRef}
          />
        </div>
        <div className="procedure-actions">
          <button onClick={handleConsentComplete} className="task-complete-btn">
            ✅ Complete Task
          </button>
        </div>
      </div>
    ) : showForm ? (
      renderParticipantForm()
    ) : (
      renderCurrentTask()
    )}
    </div>
  );
}

export default SubjectInterface;