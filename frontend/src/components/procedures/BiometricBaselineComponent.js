import React from 'react';

const BiometricBaselineComponent = ({ procedure, sessionId, onTaskComplete }) => {
  const duration = procedure?.configuration?.duration?.duration || 
                   procedure?.customDuration || 
                   procedure?.duration || 
                   5;

  return (
    <div className="procedure-task-container">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>Biometric Baseline Recording</h2>
          <h3>Please remain still and relaxed</h3>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <p>The experimenter has started the biometric baseline recording.</p>
          <p>Please sit comfortably and remain as still as possible during this recording.</p>
          <p>Try to relax and breathe normally.</p>
          <p><strong>Estimated duration: {duration} minutes</strong></p>
        </div>

        <div className="task-interface">
          <div className="baseline-message-area">
            <h3>Recording in Progress</h3>
            <p>The system is collecting baseline biometric data.</p>
            <p>When the recording period is complete, press the "Task Complete" button below.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricBaselineComponent;