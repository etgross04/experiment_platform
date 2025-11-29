import React, { useState, useEffect, useRef } from 'react';
import './SubjectInterface.css';
import { startRecording, setEventMarker } from './utils/helpers';
import MATComponent from './procedures/MATComponent';
import ConsentForm from './procedures/ConsentForm';
import PsychoPyTransitionComponent from './procedures/PsychoPyTransitionComponent';
import SurveyComponent from './procedures/SurveyComponent';
import SERBaselineComponent from './procedures/SERBaselineComponent';
import BreakComponent from './procedures/BreakComponent';
import DemographicsSurveyComponent from './procedures/DemographicsSurveyComponent';

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session');
    const mode = urlParams.get('mode');
    if (session) {
      setSessionId(session);
      loadExperimentData(session);
    }

    // Check if we're in consent mode
    if (mode === 'consent') {
      setConsentMode(true);
      setShowForm(false); // Don't show participant form initially
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
      const message = 'Are you sure you want to leave? Closing this window will abandon your experiment session and you may lose your progress.';
      event.preventDefault();
      event.returnValue = message; // For Chrome/Safari
      return message; // For other browsers
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

          default:
            return null;
        }
    }
  };

  // const getPRSSequenceNumber = (currentProcedureIndex, experimentData) => {
  //   if (!experimentData?.procedures) return 1;
    
  //   const prsCount = experimentData.procedures
  //     .slice(0, currentProcedureIndex + 1)
  //     .filter(proc => proc.id === 'prs').length;
    
  //   return prsCount;
  // };

  const renderParticipantForm = () => {
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

    if (currentProcedure && (currentProcedure.id === 'prs' || currentProcedure.id === 'main-task')) {
      return (
        <div className="waiting-screen">
          <h2>The experiment supervisor will now assist you with the next procedure.</h2>
          <div className="loading-indicator">⏳</div>
        </div>
      );
    }

    switch(currentTask) {
      case 'active':
        return renderProcedureContainer();
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