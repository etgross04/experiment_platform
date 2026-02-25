/**
 * PsychoPyTransitionComponent displays instructions and transitions for running a PsychoPy task.
 *
 * This component guides the user through the process of switching from the web interface
 * to a PsychoPy experiment. It shows task-specific or default instructions, and provides
 * a button to indicate readiness. Once started, it displays a waiting message while the
 * user completes the task in PsychoPy.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.procedure - The procedure configuration object, including task name and PsychoPy setup.
 * @param {string} props.sessionId - The current session identifier.
 *
 * @returns {JSX.Element|null} The rendered instructions or waiting message for the PsychoPy task.
 */

import React, { useState } from 'react';
import './ProcedureComponents.css';

function PsychoPyTransitionComponent({ procedure, sessionId }) {
  const [taskState, setTaskState] = useState('instructions');
  const [launching, setLaunching] = useState(false);

  const startPsychoPyTask = async () => {
    setLaunching(true);
    try {
      const response = await fetch('/api/launch-psychopy-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          task_id: procedure.id,
        })
      });
      const result = await response.json();
      if (!result.success) {
        console.error('Failed to launch PsychoPy task:', result.error);
      }
    } catch (error) {
      console.error('Error launching PsychoPy task:', error);
    }
    setLaunching(false);
    setTaskState('psychopy');
  };

  const getCustomInstructions = () => {
    const psychopyConfig = procedure.configuration?.['psychopy-setup'];
    return psychopyConfig?.psychopyInstructions || null;
  };

  const getTaskName = () => {
    return procedure.name || 'Cognitive Task';
  };

  const getPlatformName = () => {
    return procedure.platform || 'PsychoPy';
  };

  if (taskState === 'instructions') {
    const customInstructions = getCustomInstructions();
    
    return (
      <div className="procedure-instructions">
        <h4>Switch to {getPlatformName()}</h4>
        <div className="instruction-content">
          <p><strong>You will now perform the {getTaskName()} in {getPlatformName()}.</strong></p>
          {customInstructions ? (
            <div className="custom-instructions">
              <h5>Task-Specific Instructions:</h5>
              <p>{customInstructions}</p>
            </div>
          ) : (
            <div className="default-instructions">
              <ul>
                <li>Please wait for the experimenter to launch {getPlatformName()}</li>
                <li>Follow the instructions displayed in the {getPlatformName()} window</li>
                <li>Complete the task as directed</li>
                <li>Return to this window when the task is finished</li>
              </ul>
            </div>
          )}
          
          <div className="psychopy-notice">
            <p><strong>Important:</strong> Do not close this browser window. You will return here after completing the {getPlatformName()} task.</p>
          </div>
        </div>
        
        <button onClick={startPsychoPyTask} className="start-task-btn" disabled={launching}>
          {launching ? 'Launching...' : `Ready to Start ${getTaskName()}`}
        </button>
      </div>
    );
  }

  if (taskState === 'psychopy') {
    return (
      <div className="psychopy-waiting-container">
        <div className="psychopy-waiting-content">
          <h3>Performing {getTaskName()} in {getPlatformName()}</h3>
          <p>Please focus on the {getPlatformName()} window to complete your task.</p>
          <p>Follow the instructions displayed in {getPlatformName()}.</p>
        </div>
      </div>
    );
  }

  return null;
}

export default PsychoPyTransitionComponent;