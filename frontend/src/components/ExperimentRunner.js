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
      console.log(data);        // ✅ Better - shows what you just fetched
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