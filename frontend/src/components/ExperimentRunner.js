/**
 * ExperimentRunner Component - Experiment Selection and Execution Interface
 * 
 * @component ExperimentRunner
 * @description Interface for selecting, viewing, editing, and launching saved experiments.
 * Provides experiment list view, detail display, and controls for running experiments
 * by opening experimenter and subject interfaces.
 * 
 * @props
 * @param {Function} onBack - Callback to return to home view
 * 
 * @state
 * @property {Array<Experiment>} experiments - List of all available experiments
 * @property {Experiment|null} selectedExperiment - Currently selected experiment for viewing/running
 * @property {boolean} isRunning - Whether experiment launch is in progress
 * @property {string} runStatus - Status message from experiment launch process
 * 
 * @typedef {Object} Experiment
 * @property {string} id - Unique experiment identifier
 * @property {string} name - Experiment display name
 * @property {string} [description] - Experiment description
 * @property {string} created_at - ISO timestamp of creation
 * @property {number} [estimated_duration] - Total estimated duration in minutes
 * @property {Array<Procedure>} procedures - Ordered list of experimental procedures
 * @property {Object} dataCollectionMethods - Sensor configuration object
 * 
 * @typedef {Object} Procedure
 * @property {string} id - Procedure type identifier
 * @property {string} name - Procedure display name
 * @property {number} duration - Duration in minutes
 * @property {number} customDuration - User-configured duration
 * @property {string} instanceId - Unique instance identifier
 * @property {Object} configuration - Procedure-specific configuration
 * @property {string} [platform] - External platform name (e.g., 'PsychoPy')
 * 
 * @api_endpoints
 * 
 * GET /api/experiments
 * @returns {Array<Experiment>} List of all saved experiments
 * @description Loads all available experiments for selection
 * 
 * POST /api/experiments/{experimentId}/run
 * @param {string} experimentId - Experiment ID to run
 * @body {participant_id: string}
 * @returns {{session_id: string, error?: string}}
 * @description Creates new experiment session and returns session ID
 * Session ID format: {experimentId}_{timestamp}_{random}
 * 
 * @functions
 * 
 * @function loadExperiments
 * @async
 * @description Fetches all experiments from server and populates experiments list
 * Called on component mount
 * 
 * @function editExperiment
 * @description Navigates to ExperimentBuilder in edit mode for selected experiment
 * Sets sessionStorage flag 'internalNavigation' to prevent navigation warnings
 * Redirects to: /?view=builder&edit={experimentId}
 * 
 * @function runExperiment
 * @async
 * @description Launches experiment by:
 * 1. Creating new session via POST to /api/experiments/{id}/run
 * 2. Opening experimenter interface in new window
 * 3. Returning session ID for manual launch if popup blocked
 * 
 * Window specs for experimenter:
 * - Name: 'experimenter'
 * - Dimensions: 1400x900
 * - Position: top-left (0,0)
 * - Features: resizable, scrollbars
 * - URL: http://localhost:3000/experimenter?session={sessionId}
 * 
 * @behavior
 * 
 * Initialization:
 * - Loads all experiments on mount
 * - No experiment pre-selected
 * 
 * Experiment Selection:
 * - Click experiment card to select
 * - Selected card highlighted
 * - Details panel updates with procedures list
 * 
 * Edit Flow:
 * 1. Select experiment
 * 2. Click "Edit Experiment"
 * 3. Navigate to builder with ?edit={experimentId}
 * 4. Builder loads experiment for editing
 * 
 * Run Flow:
 * 1. Select experiment
 * 2. Click "Launch Experiment"
 * 3. Status: "Starting experiment..."
 * 4. Creates session via API
 * 5. Opens experimenter window
 * 6. Status: "Experimenter interface launched! Session: {sessionId}"
 * 7. If popup blocked: "Please manually open: {url}"
 * 
 * Error Handling:
 * - No experiment selected: Alert "Please select an experiment first"
 * - API error: Display error in runStatus
 * - Network error: Display error message
 * 
 * @ui_sections
 * 
 * Experiment List (Left Panel):
 * - Scrollable list of experiment cards
 * - Each card shows: name, description, created date, duration
 * - Click to select
 * - Empty state: "No experiments found. Create one in the Experiment Builder first."
 * 
 * Experiment Details (Right Panel):
 * - Selected experiment name
 * - Edit/Launch buttons
 * - Status message area
 * - Procedures list with step numbers and durations
 * - Empty state: "Select an experiment from the list to see details and run it."
 * 
 * @navigation
 * - sessionStorage.setItem('internalNavigation', 'true') prevents navigation warnings
 * - window.location.href for builder navigation (full reload)
 * - window.open() for experimenter interface (new window)
 * 
 * @notes
 * - Participant ID hardcoded as 'anonymous' (replaced during session setup)
 * - Experimenter window must be opened by user gesture (popup blocker)
 * - Session ID returned for manual launch if popup blocked
 * - Procedures can be string or object format (backward compatibility)
 * - Edit mode uses URL parameter to load experiment in builder
 * - No confirmation prompt for launching experiment
 * - No session cleanup on component unmount
 */

import React, { useState, useEffect } from 'react';
import './ExperimentRunner.css';

function ExperimentRunner({ onBack }) {
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  
  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    try {
      const response = await fetch('/api/experiments');
      const data = await response.json();
      setExperiments(data);
      console.log(data);        
    } catch (error) {
      console.error('Error loading experiments:', error);
    }
  };

  const editExperiment = () => {
    if (!selectedExperiment) {
      alert('Please select an experiment first');
      return;
    }
    
    sessionStorage.setItem('internalNavigation', 'true');
    // Navigate to experiment builder with edit parameter
    window.location.href = `/?view=builder&edit=${selectedExperiment.id}`;
  };

  const runExperiment = async () => {
    if (!selectedExperiment) {
      alert('Please select an experiment first');
      return;
    }

    setIsRunning(true);
    setRunStatus('Starting experiment...');

    try {
      const response = await fetch(`/api/experiments/${selectedExperiment.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_id: 'anonymous'
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        const sessionId = data.session_id;
        const experimenterUrl = `http://localhost:3000/experimenter?session=${sessionId}`;
        
        const experimenterWindow = window.open(
          experimenterUrl, 
          'experimenter', 
          'width=1400,height=900,left=0,top=0,resizable=yes,scrollbars=yes'
        );
        
        if (experimenterWindow) {
          setRunStatus(`Experimenter interface launched! Session: ${sessionId}`);
        } else {
          setRunStatus(`Please manually open: ${experimenterUrl}`);
        }
        
      } else {
        setRunStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setRunStatus(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="experiment-runner">
      <button className="back-button" onClick={onBack}>
        ← Back to Home
      </button>
      
      <h2>Run Experiment</h2>
      
      <div className="runner-content">
        <div className="experiment-list">
          <h3>Available Experiments</h3>
          {experiments.length === 0 ? (
            <p>No experiments found. Create one in the Experiment Builder first.</p>
          ) : (
            <div className="experiment-items">
              {experiments.map((experiment) => (
                <div 
                  key={experiment.id} 
                  className={`experiment-item ${selectedExperiment?.id === experiment.id ? 'selected' : ''}`}
                  onClick={() => setSelectedExperiment(experiment)}
                >
                  <h4>{experiment.name}</h4>
                  <p>{experiment.description}</p>
                  <small>
                    Created: {new Date(experiment.created_at).toLocaleDateString()}
                    {experiment.estimated_duration && ` • Duration: ~${experiment.estimated_duration} min`}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="experiment-details">
          {selectedExperiment ? (
            <div>
              <h3>Selected: {selectedExperiment.name}</h3>
              {/* <p>{selectedExperiment.description}</p> */}
              
              <div className="run-controls">
                <button 
                  className="edit-button"
                  onClick={editExperiment}
                  disabled={!selectedExperiment}
                >
                  Edit Experiment
                </button>
                <button 
                  className="run-button"
                  onClick={runExperiment}
                  disabled={isRunning}
                >
                  {isRunning ? 'Starting...' : 'Launch Experiment'}
                </button>
                
                {runStatus && (
                  <div className="run-status">
                    <p>{runStatus}</p>
                  </div>
                )}
              </div>
              {/* Experiment Procedures List */}
              <div className="experiment-procedures-section">
                <h4>Experiment Procedures</h4>
                <div className="procedures-simple-list">
                  {selectedExperiment.procedures?.map((procedure, index) => (
                    <div key={index} className="procedure-simple-item">
                      <span className="procedure-step">{index + 1}.</span>
                      <span className="procedure-simple-name">{typeof procedure === 'string' ? procedure : procedure.name}</span>
                      <span className="procedure-simple-duration">{typeof procedure === 'object' ? `${procedure.duration} min` : ' -- min'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select an experiment from the list to see details and run it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExperimentRunner;