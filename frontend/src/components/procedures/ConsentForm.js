/**
 * ConsentForm React component for displaying and recording user consent in an experiment platform.
 *
 * This component supports multiple consent document sources:
 * - Uploaded PDF files
 * - External document links
 * - Default hard copy instructions
 *
 * Props:
 * @param {Object} props
 * @param {Object} props.procedure - Procedure configuration object containing consent document details.
 * @param {string|number} props.sessionId - Unique identifier for the current session.
 * @param {React.Ref} ref - Ref forwarded to expose imperative handle for procedure completion.
 *
 * Imperative Handle Methods:
 * @method handleProcedureComplete
 *   Validates user consent and records it via an API call.
 *   Throws an error if consent is not provided.
 *
 * State:
 * - consentMethod: Determines how the consent document is displayed ('upload', 'link', or 'default').
 * - consentData: Data for the consent document (file path, file name, or link).
 * - loading: Indicates if the consent form is loading.
 * - error: Error message if loading fails.
 * - consentAgreed: Tracks if the user has agreed to the consent form.
 *
 * UI:
 * - Displays the consent document (PDF or link) or default instructions.
 * - Provides a checkbox for the user to confirm consent.
 * - Shows reminders and confirmation messages based on user interaction.
 *
 * @component
 */

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import './ConsentForm.css'; 
import { setEventMarker } from '../utils/helpers';


const ConsentForm = forwardRef(({ procedure, sessionId }, ref) => {
  const [consentMethod, setConsentMethod] = useState(null);
  const [consentData, setConsentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState(null);
  const [consentAgreed, setConsentAgreed] = useState(false); 

  useImperativeHandle(ref, () => ({
    handleProcedureComplete: async () => {
      if (!consentAgreed) {
        alert('Please confirm that you have read and agree to the consent form before continuing.');
        throw new Error('Consent not provided'); 
      }

      try {
        await fetch(`/api/sessions/${sessionId}/record-consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            consentGiven: true,
            consentMethod: consentMethod,
            consentAgreed: consentAgreed,
            timestamp: new Date().toISOString()
          })
        });
        setEventMarker('subject_idle');
        console.log('Consent recorded successfully');
      } catch (error) {
        console.error('Error recording consent:', error);
        throw error; 
      }
    }
  }));

  useEffect(() => {
    const config = procedure?.configuration || {};
    const documentConfig = config.document || {};
    const wizardData = procedure?.wizardData || {};
    const rawConfig = wizardData.rawConfiguration?.document || {};
    const consentLink = documentConfig.consentLink || wizardData.consentLink || rawConfig.consentLink;
    
    if (consentLink) {
      setConsentMethod('link');
      setConsentData({ link: consentLink });
    } else {
      setConsentMethod('default');
      setConsentData(null);
    }
    
    setLoading(false);
  }, [procedure]);

  const handleConsentChange = (e) => {
    setConsentAgreed(e.target.checked);
  };

  if (loading) {
    return (
      <div className="consent-form-container">
        <div className="loading">
          <h3>Loading consent form...</h3>
          <div className="loading-spinner">⏳</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="consent-form-container">
        <div className="error">
          <h3>Error Loading Consent Form</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="consent-form-container">
      <div className="consent-content">
        {consentMethod === 'upload' && consentData?.filePath && (
          <div className="pdf-container">
            <h3>Consent Document</h3>
            <div className="pdf-viewer">
              <iframe
                src={`/consent_forms/${consentData.filePath.split('/').slice(-2).join('/')}`}
                width="100%"
                height="600px"
                title="Consent Form"
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              >
                <p>
                  Your browser does not support displaying PDF files. 
                  <a href={`/consent_forms/${consentData.filePath.split('/').slice(-2).join('/')}`} target="_blank" rel="noopener noreferrer">
                    Click here to download the consent form.
                  </a>
                </p>
              </iframe>
            </div>
          </div>
        )}

        {consentMethod === 'link' && consentData?.link && (
        <div className="link-container">
          <h3>Consent Document</h3>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            The consent form has been opened in a separate window. Please review it carefully before providing your consent below.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            If the consent form did not open automatically, 
            <a href={consentData.link} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: '#3b82f6' }}>
              click here to open it
            </a>.
          </p>
        </div>
      )}

        {consentMethod === 'default' && (
          <div className="default-consent-container">
            <div className="default-consent-content">
              <p>
                You are being invited to participate in a research study. Before you agree to participate, 
                please read the following information. 
              </p>
              <div className="consent-points">
                <h4>Instructions:</h4>
                <ul>
                  <li>The experimenter will present you with a hard copy consent form. Please read the form carefully and ask any questions you may have.</li>
                  <li>Please fill out the form, then print and sign your name.</li>
                  <li>Your data will be kept confidential</li>
                </ul>
              </div>
              <p>
                By checking the agreement box below, you indicate that you have read and understood 
                this information and the consent form. 
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="consent-agreement">
        <div className="agreement-checkbox">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={handleConsentChange}
              className="consent-checkbox"
            />
            <span className="checkmark"></span>
            <span className="checkbox-text">
              <strong>I have read and understand the consent form. I have signed the form and voluntarily agree to participate in this research study.</strong>
            </span>
          </label>
        </div>
        
        {!consentAgreed && (
          <div className="agreement-reminder">
            <p className="reminder-text">
              ⚠️ Please check the box above to confirm your consent before proceeding.
            </p>
          </div>
        )}
        
        {consentAgreed && (
          <div className="agreement-confirmed">
            <p className="confirmed-text">
              ✅ Thank you for providing your consent. You may now complete the task.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export default ConsentForm;