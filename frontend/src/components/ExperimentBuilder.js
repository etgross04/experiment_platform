/**
 * ExperimentBuilder Component - React Interface for Psychological Experiment Design
 * 
 * @component ExperimentBuilder
 * @description Drag-and-drop interface for assembling and configuring psychological experiments.
 * Manages experimental procedures, configurations, templates, and paradigms.
 * 
 * @props
 * @param {Function} onBack - Callback to return to home view
 * 
 * @state
 * @property {string} experimentName - Name of the current experiment design
 * @property {Array<Procedure>} selectedProcedures - Ordered array of procedures in experiment
 * @property {string|null} selectedProcedureId - Currently selected procedure instanceId
 * @property {Procedure|null} currentWizardProcedure - Procedure being configured in wizard
 * @property {Object|null} config - Loaded experiment configuration (procedures, categories, paradigms, wizardSteps)
 * @property {boolean} loading - Loading state for initial configuration fetch
 * @property {string|null} error - Error message from configuration loading
 * @property {boolean} showTemplateSaveWizard - Template save wizard visibility
 * @property {boolean} isEditMode - Whether editing existing experiment
 * @property {string|null} editingExperimentId - ID of experiment being edited
 * @property {boolean} isLoadingEdit - Loading state for edit mode initialization
 * 
 * @typedef {Object} Procedure
 * @property {string} id - Procedure type identifier (e.g., 'consent', 'prs', 'main-task')
 * @property {string} name - Display name
 * @property {number} duration - Base duration in minutes
 * @property {number} customDuration - User-configured duration in minutes
 * @property {string} color - Hex color code for visual identification
 * @property {boolean} required - Whether procedure is mandatory
 * @property {string} [platform] - External platform name (e.g., 'PsychoPy', 'OpenSesame')
 * @property {number} position - Order index in experiment sequence
 * @property {string} instanceId - Unique instance identifier (format: {id}_{timestamp}_{suffix})
 * @property {Object} configuration - Procedure-specific configuration data
 * @property {Object} wizardData - Legacy wizard configuration structure
 * 
 * @typedef {Object} Configuration
 * @property {Object.<string, ProcedureDefinition>} procedures - Available procedures keyed by ID
 * @property {Object.<string, Category>} categories - Procedure categories
 * @property {Object.<string, Paradigm>} paradigms - Experimental templates
 * @property {Object.<string, Array<WizardStep>>} wizardSteps - Configuration wizard definitions
 * 
 * @typedef {Object} ProcedureDefinition
 * @property {string} id - Unique procedure identifier
 * @property {string} name - Display name
 * @property {number} duration - Default duration in minutes
 * @property {string} color - Hex color code
 * @property {boolean} required - Whether procedure is mandatory
 * @property {string} category - Category ID this procedure belongs to
 * @property {string} [platform] - External platform name
 * @property {Array<string>} [instructionSteps] - Experimenter instruction steps
 * 
 * @typedef {Object} Category
 * @property {string} name - Display name
 * @property {string} description - Category description
 * @property {string} [icon] - Icon/emoji representation
 * 
 * @typedef {Object} Paradigm
 * @property {string} name - Template display name
 * @property {string} description - Template description
 * @property {string} color - Hex color code
 * @property {Array<ParadigmProcedure>} procedures - Procedures in this template
 * 
 * @typedef {Object} ParadigmProcedure
 * @property {string} id - Procedure type identifier
 * @property {number} position - Order in paradigm
 * @property {string} [customName] - Override for procedure name
 * @property {number} [customDuration] - Override for procedure duration
 * @property {Object} [preConfigured] - Pre-filled configuration data
 * 
 * @typedef {Object} WizardStep
 * @property {string} id - Step identifier (e.g., 'collection-methods', 'survey-details')
 * @property {string} title - Step display title
 * @property {string} description - Step description/instructions
 * 
 * @functions
 * 
 * @function createDataCollectionProcedure
 * @returns {Procedure} Data collection procedure with sensor configuration template
 * @description Creates mandatory data collection procedure tracking sensor configurations.
 * Position always 0. Configuration includes: polar_hr, vernier_resp, emotibit, audio_ser (all false by default).
 * 
 * @function createInitialConsentProcedure
 * @param {Configuration} config - Experiment configuration
 * @returns {Procedure} Consent form procedure
 * @description Creates consent form procedure from configuration. Position always 1.
 * Falls back to default if not defined in config.
 * 
 * @function procedureRequiresAudio
 * @param {string} procedureId - Procedure type identifier
 * @param {Object} configuration - Procedure configuration
 * @returns {boolean} Whether procedure requires audio recording
 * @description Determines if procedure needs audio enabled. Returns true for:
 * - prs (Perceived Restorativeness Scale)
 * - main-task
 * - vr-room-task
 * - ser-baseline
 * - stressor (when Mental Arithmetic Task selected)
 * 
 * @function shouldAutoEnableAudio
 * @param {Array<Procedure>} procedures - Array of procedures
 * @returns {boolean} Whether any procedure requires audio
 * @description Checks if any procedure in array requires audio recording.
 * 
 * @function createLegacyWizardData
 * @param {Object} [configuration={}] - Configuration object
 * @returns {Object} Legacy wizard data structure
 * @description Creates backward-compatible wizard data with null defaults and rawConfiguration.
 * 
 * @api_endpoints
 * 
 * GET /api/experiment-config
 * @returns {Configuration} Complete experiment configuration
 * @description Loads procedures, categories, paradigms, and wizard step definitions.
 * 
 * POST /api/experiments
 * @body {ExperimentData} Experiment design data
 * @returns {{success: boolean, id: string, error?: string}}
 * @description Saves new experiment design.
 * 
 * PUT /api/experiments/:id
 * @param {string} id - Experiment ID
 * @body {ExperimentData} Updated experiment data
 * @returns {{success: boolean, id: string, error?: string}}
 * @description Updates existing experiment.
 * 
 * GET /api/experiments/:id
 * @param {string} id - Experiment ID
 * @returns {ExperimentData} Experiment design
 * @description Retrieves experiment for editing.
 * 
 * POST /api/add-psychopy-procedure
 * @body {ProcedureForm} New procedure definition
 * @returns {{success: boolean, procedure: ProcedureDefinition, error?: string}}
 * @description Adds custom external procedure to library.
 * 
 * POST /api/save-template
 * @body {TemplateData} Template definition
 * @returns {{success: boolean, error?: string}}
 * @description Saves experiment design as reusable template.
 * 
 * GET /api/vr-room-audio/:audioSetName
 * @param {string} audioSetName - Audio set identifier
 * @returns {{files: Array<string>}}
 * @description Lists available audio files for VR Room Task.
 * 
 * POST /api/upload-vr-room-audio
 * @body {FormData} audioSetName, audioFiles
 * @returns {{success: boolean, error?: string}}
 * @description Uploads audio files for VR Room Task.
 * 
 * POST /api/upload-vr-room-config
 * @body {FormData} audioSetName, configFile
 * @returns {{success: boolean, config: Object, error?: string}}
 * @description Uploads VR Room Task sequence configuration.
 * 
 * POST /api/upload-main-task-audio
 * @body {FormData} questionSetName, audioFiles
 * @returns {{success: boolean, error?: string}}
 * @description Uploads audio files for Main Task.
 * 
 * @typedef {Object} ExperimentData
 * @property {string} [id] - Experiment ID (for updates)
 * @property {string} name - Experiment name
 * @property {Array<Procedure>} procedures - Ordered procedures
 * @property {Object} dataCollectionMethods - Sensor configuration (polar_hr, vernier_resp, emotibit, audio_ser)
 * @property {string} created_at - ISO timestamp
 * @property {number} estimated_duration - Total duration in minutes
 * 
 * @typedef {Object} ProcedureForm
 * @property {string} name - Procedure name
 * @property {number} duration - Duration in minutes (1-120)
 * @property {string} category - Category ID
 * @property {string} platform - Platform name ('PsychoPy', 'OpenSesame', etc.)
 * @property {string} color - Hex color code
 * @property {boolean} required - Whether mandatory
 * @property {Array<string>} instructionSteps - Experimenter instructions
 * 
 * @typedef {Object} TemplateData
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {string} category - Category ID or new category name
 * @property {string} color - Hex color code
 * @property {Array<ParadigmProcedure>} procedures - Template procedures
 * 
 * @wizard_steps
 * 
 * Common Steps:
 * - collection-methods: Sensor/data collection configuration
 * - duration: Procedure duration configuration
 * - validation: Configuration summary and review
 * 
 * Consent Form:
 * - document: External consent form link
 * 
 * Survey/Demographics:
 * - survey-method: Delivery method (external/embedded Google Forms)
 * - survey-link: URL configuration
 * - setup-instructions: Autofill setup guide
 * - survey-details: Survey name and URL
 * 
 * Task Procedures (PRS, Main Task, SER):
 * - question-set: Question set selection
 * - task-description: Condition marker configuration
 * 
 * VR Room Task:
 * - session-type-selection: Practice/first_room/subsequent_room
 * - audio-set-selection: Audio file upload and management
 * - sequence-editor: Step sequence configuration
 * 
 * Break:
 * - media-selection: Video selection
 * 
 * Stressor:
 * - stressor-type: Task type selection (Mental Arithmetic/Time Pressure)
 * 
 * SART:
 * - task-setup: Standard vs custom configuration
 * 
 * External Procedures:
 * - psychopy-setup: External platform configuration
 * 
 * @behavior
 * 
 * Initialization:
 * - Loads experiment-config.json on mount
 * - Creates data-collection (position 0) and consent (position 1) procedures automatically
 * - Checks URL for ?edit={id} parameter to load existing experiment
 * 
 * Auto-Enable Audio:
 * - Monitors procedures for audio requirements
 * - Automatically enables audio_ser in data-collection when needed
 * - Triggers on procedure addition or configuration changes
 * 
 * Drag-and-Drop:
 * - Procedures draggable from library to canvas (except consent)
 * - Procedures reorderable on canvas (except positions 0-1)
 * - Paradigms replace all procedures except data-collection
 * - Data-collection and consent are sticky at positions 0-1
 * 
 * Edit Mode:
 * - Loads experiment from URL parameter
 * - Populates canvas with saved procedures
 * - Save button updates existing experiment
 * - Exits edit mode after successful save
 * 
 * Configuration Validation:
 * - Consent: Requires consentLink
 * - Survey: Requires surveyName and googleFormUrl
 * - Main Task: Requires conditionMarker
 * - Break: Requires selectedVideo
 * - Validates before proceeding to next wizard step
 * 
 * @subcomponents
 * 
 * @component TemplateSaveWizard
 * @description Modal for saving experiment as reusable template
 * @props {Function} onClose, {Function} onSave, {Configuration} config
 * 
 * @component AddProcedureForm
 * @description Modal for creating custom external procedures
 * @props {Function} onClose, {Function} onProcedureAdded, {Configuration} config
 * 
 * @component ExampleExperimentView
 * @description Procedure library with collapsible categories and templates
 * @props {Function} onDragStart, {Function} onParadigmDragStart, {Configuration} config, {Function} onProcedureAdded
 * 
 * @component ExperimentCanvas
 * @description Main design canvas with procedure sequencing
 * @props See ExperimentCanvas contract
 * 
 * @component ProcedureWizard
 * @description Multi-step configuration wizard for procedures
 * @props {Procedure} procedure, {Function} onClose, {Function} onSave, {Configuration} config
 * 
 * @component AudioFileSelector
 * @description Dropdown selector for audio files from uploaded sets
 * @props {string} audioSetName, {string} selectedFile, {Function} onChange
 * 
 * @component WizardStepContent
 * @description Renders form fields for specific wizard steps
 * @props {string} stepId, {string} procedureId, {*} value, {Object} configuration, {Function} onChange
 * 
 * @notes
 * - Data-collection and consent procedures cannot be removed or reordered
 * - Instance IDs prevent duplicate procedures from conflicting
 * - Configuration validation prevents incomplete setups
 * - Template system excludes data-collection (auto-added per experiment)
 * - VR Room Task audio files shared across multiple instances
 * - Each VR Room Task instance can have unique sequence configuration
 * - URL parameters support direct edit mode: ?edit={experimentId}
 */

import React, { useState, useEffect, useRef } from 'react';
import './ExperimentBuilder.css';

function createDataCollectionProcedure() {
  return {
    id: 'data-collection',
    name: 'Sensors',
    duration: 0,
    customDuration: 0,
    color: '#8B5CF6',
    required: true,
    position: 0,
    instanceId: `data_collection_${Date.now()}`,
    configuration: {
      'collection-methods': {
        polar_hr: false,
        vernier_resp: false,
        emotibit: false,
        audio_ser: false
      }
    },
    wizardData: createLegacyWizardData({})
  };
}

function createInitialConsentProcedure(config) {
  const consentProcedure = config?.procedures?.consent;
  if (!consentProcedure) {
    return {
      id: 'consent',
      name: 'Consent Form',
      duration: 5,
      customDuration: 5,
      color: '#3B82F6',
      required: true,
      position: 1,
      instanceId: `consent_${Date.now()}`,
      configuration: {},
      wizardData: createLegacyWizardData({})
    };
  }
  return {
    id: consentProcedure.id,
    name: consentProcedure.name,
    duration: consentProcedure.duration,
    customDuration: consentProcedure.duration,
    color: consentProcedure.color,
    required: consentProcedure.required,
    position: 1,
    instanceId: `consent_${Date.now()}`,
    configuration: {},
    wizardData: createLegacyWizardData({})
  };
}

function procedureRequiresAudio(procedureId, configuration) {
  // PRS always needs audio
  if (procedureId === 'prs') {
    return true;
  }
  
  // Main Task always needs audio
  if (procedureId === 'main-task') {
    return true;
  }
  
  // VR Room Task always needs audio
  if (procedureId === 'vr-room-task') {
    return true;
  }
  
  // SER Baseline always needs audio
  if (procedureId === 'ser-baseline') {
    return true;
  }
  
  // Stressor needs audio if Mental Arithmetic Task is selected
  if (procedureId === 'stressor') {
    const stressorType = configuration?.['stressor-type']?.stressorType;
    if (stressorType === 'Mental Arithmetic Task') {
      return true;
    }
  }
  
  return false;
}

function shouldAutoEnableAudio(procedures) {
  return procedures.some(proc => 
    procedureRequiresAudio(proc.id, proc.configuration)
  );
}

function createLegacyWizardData(configuration = {}) {
  return {
    surveyFiles: null,
    standardFields: null,
    questionOrder: null,
    enableBranching: null,
    consentMethod: null,
    consentDocument: null,
    consentFilePath: null,
    consentLink: null,
    requireSignature: null,
    selectedSensors: null,
    recordingDuration: null,
    baselineTask: null,
    usePsychoPy: false,
    psychopyInstructions: null,
    sartVersion: null,
    targetDigit: null,
    rawConfiguration: configuration
  };
}

function TemplateSaveWizard({ onClose, onSave, config }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    color: '#8B5CF6',
    useExistingCategory: true
  });

  // Get existing paradigm categories from config
  const existingCategories = config?.paradigms ? Object.keys(config.paradigms) : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (!formData.category.trim()) {
      alert('Please select or enter a category');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h2>Save as Experiment Template</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="wizard-content">
          <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
            Save this experiment design as a reusable template that will appear in the "Experiment Templates" section.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Stress Induction Protocol"
              />
              <small style={{ color: '#666', display: 'block', marginTop: '0.5rem' }}>
                This name will appear when users browse templates
              </small>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe this experimental template and when it should be used..."
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Template Category *</label>
              <div className="radio-group" style={{ marginBottom: '1rem' }}>
                <label className="radio-label">
                  <input 
                    type="radio"
                    name="categoryType"
                    checked={formData.useExistingCategory}
                    onChange={() => setFormData({...formData, useExistingCategory: true, category: ''})}
                  />
                  Use existing category
                </label>
                <label className="radio-label">
                  <input 
                    type="radio"
                    name="categoryType"
                    checked={!formData.useExistingCategory}
                    onChange={() => setFormData({...formData, useExistingCategory: false, category: ''})}
                  />
                  Create new category
                </label>
              </div>

              {formData.useExistingCategory ? (
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  style={{ width: '100%' }}
                >
                  <option value="">Select a category...</option>
                  {existingCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {config.paradigms[cat].name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  placeholder="e.g., Attention Training, Memory Tasks, Custom Protocol"
                />
              )}
              <small style={{ color: '#666', display: 'block', marginTop: '0.5rem' }}>
                {formData.useExistingCategory 
                  ? 'Choose a category where this template will appear' 
                  : 'Create a new category - it will appear as a new template group'}
              </small>
            </div>

            <div className="form-group">
              <label>Color Theme</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                style={{ width: '100px', height: '40px' }}
              />
              <small style={{ color: '#666', display: 'block', marginTop: '0.5rem' }}>
                This color will be used for the template's visual identification
              </small>
            </div>

            <button type="submit" className="wizard-btn primary">
              Save Template
            </button>
          </form>
        </div>

        <div className="wizard-footer">
          <button onClick={onClose} className="wizard-btn secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProcedureForm({ onClose, onProcedureAdded, config }) {
  const [formData, setFormData] = useState({
    name: '',
    duration: 15,
    category: '',
    platform: 'PsychoPy', 
    color: '#8B5CF6',
    required: false,
    instructionSteps: [''] // Start with one empty instruction step
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleInstructionStepChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      instructionSteps: prev.instructionSteps.map((step, i) => 
        i === index ? value : step
      )
    }));
    
    // Clear instruction step errors
    if (errors.instructionSteps) {
      setErrors(prev => ({
        ...prev,
        instructionSteps: ''
      }));
    }
  };

  const addInstructionStep = () => {
    setFormData(prev => ({
      ...prev,
      instructionSteps: [...prev.instructionSteps, '']
    }));
  };

  const removeInstructionStep = (index) => {
    if (formData.instructionSteps.length > 1) {
      setFormData(prev => ({
        ...prev,
        instructionSteps: prev.instructionSteps.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Procedure name is required';
    }
    
    if (!formData.duration || formData.duration < 1) {
      newErrors.duration = 'Duration must be at least 1 minute';
    }
    
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }
    
    // Validate instruction steps
    if (formData.instructionSteps.length === 0) {
      newErrors.instructionSteps = 'At least one instruction step is required';
    } else {
      const emptySteps = formData.instructionSteps.some(step => !step.trim());
      if (emptySteps) {
        newErrors.instructionSteps = 'All instruction steps must have content';
      }
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/add-psychopy-procedure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        alert('PsychoPy procedure added successfully!');
        onProcedureAdded(result.procedure);
        onClose();
      } else {
        throw new Error(result.error || 'Failed to add procedure');
      }
    } catch (error) {
      console.error('Error adding procedure:', error);
      alert(`Error adding procedure: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h2>Add External Procedure</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="wizard-content">
          <h3>Add an external procedure to your library (e.g. PsychoPy)</h3>
          
          <form onSubmit={handleSubmit} className="add-procedure-form">
            <div className="form-group">
              <label htmlFor="name">Procedure Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? 'error' : ''}
                placeholder="e.g., Stroop Task, N-Back Task"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="platform">Experiment Platform *</label>
              <select
                id="platform"
                name="platform"
                value={formData.platform}
                onChange={handleInputChange}
                style={{ width: '100%' }}
              >
                <option value="PsychoPy">PsychoPy</option>
                <option value="OpenSesame">OpenSesame</option>
                <option value="jsPsych">jsPsych</option>
                <option value="E-Prime">E-Prime</option>
                <option value="Inquisit">Inquisit</option>
                <option value="Gorilla">Gorilla</option>
                <option value="lab.js">lab.js</option>
                <option value="PsyToolkit">PsyToolkit</option>
                <option value="Other">Other</option>
              </select>
              <small style={{ color: '#666', display: 'block', marginTop: '0.5rem' }}>
                Select the platform where this procedure will be executed
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="duration">Expected Duration (minutes) *</label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                min="1"
                max="120"
                className={errors.duration ? 'error' : ''}
              />
              {errors.duration && <span className="error-text">{errors.duration}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={errors.category ? 'error' : ''}
              >
                <option value="">Select a category...</option>
                {config && config.categories && Object.entries(config.categories).map(([categoryId, categoryData]) => (
                  <option key={categoryId} value={categoryId}>
                    {categoryData.name}
                  </option>
                ))}
              </select>
              {errors.category && <span className="error-text">{errors.category}</span>}
              {formData.category && config?.categories?.[formData.category] && (
                <small>{config.categories[formData.category].description}</small>
              )}
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="required"
                  checked={formData.required}
                  onChange={handleInputChange}
                />
                Required procedure
              </label>
            </div>

            <div className="form-group">
              <div className="instruction-steps-header">
                <label>Experimenter Instructions *</label>
                <button
                  type="button"
                  onClick={addInstructionStep}
                  className="add-step-btn"
                  title="Add another instruction step"
                >
                  + Add Step
                </button>
              </div>
              
              {errors.instructionSteps && (
                <span className="error-text">{errors.instructionSteps}</span>
              )}
              
              <div className="instruction-steps-container">
                {formData.instructionSteps.map((step, index) => (
                  <div key={index} className="instruction-step">
                    <div className="instruction-step-header">
                      <span className="step-number">Step {index + 1}</span>
                      {formData.instructionSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInstructionStep(index)}
                          className="remove-step-btn"
                          title="Remove this step"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <textarea
                      value={step}
                      onChange={(e) => handleInstructionStepChange(index, e.target.value)}
                      className={errors.instructionSteps ? 'error' : ''}
                      rows="4"
                      placeholder={`Enter instructions for step ${index + 1}...`}
                    />
                  </div>
                ))}
              </div>
              
              <small>
                These instructions will be displayed to experimenters in the pre-test instruction wizard. 
                Each step will be shown separately in the instruction sequence.
              </small>
            </div>

            <button
              onClick={handleSubmit}
              className="wizard-btn primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Procedure'}
            </button>
          </form>
        </div>

        <div className="wizard-footer">
          <button
            onClick={onClose}
            className="wizard-btn secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ExampleExperimentView({ onDragStart, onParadigmDragStart, config, onProcedureAdded }) {
  const [expandedSections, setExpandedSections] = useState({
    'test-procedures': false,
    'experiment-paradigms': false,
    'add-procedures': false
  });

  const [expandedCategories, setExpandedCategories] = useState({});
  const [showAddProcedureForm, setShowAddProcedureForm] = useState(false);

  useEffect(() => {
    if (config?.categories) {
      const initialExpanded = {};
      Object.keys(config.categories).forEach(categoryId => {
        initialExpanded[categoryId] = false;
      });
      setExpandedCategories(initialExpanded);
    }
  }, [config]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const getTotalProcedureCount = () => {
    if (!config?.procedures) return 0;
    return Object.keys(config.procedures).length;
  };

  const getProceduresByCategory = () => {
    if (!config?.procedures || !config?.categories) return {};
    
    const categorized = {};
    Object.entries(config.categories).forEach(([categoryId, categoryData]) => {
      categorized[categoryId] = {
        ...categoryData,
        procedures: Object.values(config.procedures).filter(proc => proc.category === categoryId)
      };
    });
    return categorized;
  };

  const handleProcedureAdded = (newProcedure) => {
    // Call the parent's callback to update config
    onProcedureAdded(newProcedure);
    
    // Optionally expand the category to show the new procedure
    if (newProcedure.category) {
      setExpandedCategories(prev => ({
        ...prev,
        [newProcedure.category]: true
      }));
    }
  };

  const totalCount = getTotalProcedureCount();
  const procedureCategories = getProceduresByCategory();

  if (!config) {
    return <div className="example-experiment">Loading procedure library...</div>;
  }
  
  return (
    <div className="example-experiment">
      {/* <div className="example-header">
        <h3>Procedure Library</h3>
        <div className="example-note">
          <p>Drag individual procedures or complete paradigms to your design →</p>
          <p><strong>Note:</strong> Consent form is always required and will stay at the top</p>
        </div>
      </div> */}
      
      {/* Test Procedures Section */}
      <div className="procedure-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('test-procedures')}
        >
          <div className="section-toggle">
            <span className={`toggle-arrow ${expandedSections['test-procedures'] ? 'expanded' : ''}`}>
              ►
            </span>
          </div>
          <div className="section-info">
            {/* <span className="section-icon">🔧</span> */}
            <div className="section-text">
              <div className="section-name">Test Components</div>
              {/* <div className="section-description">Individual procedure components</div> */}
            </div>
            <span className="procedure-count">
              ({totalCount})
            </span>
          </div>
          
        </div>
        
        {expandedSections['test-procedures'] && (
          <div className="section-content">
            <div className="procedure-categories">
              {Object.entries(procedureCategories).map(([categoryId, category]) => (
                <div key={categoryId} className="procedure-category">
                  <div 
                    className="category-header"
                    onClick={() => toggleCategory(categoryId)}
                  >
                  <div className="section-toggle">
                    <span className={`toggle-arrow ${expandedCategories[categoryId] ? 'expanded' : ''}`}>
                    ►
                    </span>
                  </div>
                    <div className="category-info">
                      {/* <span className="category-icon">{category.icon}</span> */}
                      <div className="category-text">
                        <div className="category-name">{category.name}</div>
                        <div className="category-description">{category.description}</div>
                      </div>
                    </div>
                    <div className="category-toggle">
                      <span className="procedure-count">
                        ({category.procedures.length})
                      </span>
                    </div>
                  </div>
                  
                  {expandedCategories[categoryId] && (
                    <div className="category-procedures">
                      {category.procedures.map((procedure, index) => (
                        <React.Fragment key={procedure.id}>
                          <div
                            className={`example-procedure compact ${procedure.id === 'consent' ? 'consent-procedure' : ''}`}
                            draggable={procedure.id !== 'consent'} // Prevent dragging consent form
                            onDragStart={(e) => {
                              if (procedure.id === 'consent') {
                                e.preventDefault();
                                return;
                              }
                              onDragStart(e, procedure);
                            }}
                          >
                            <div className="procedure-details">
                              <div className="procedure-name-row">
                                <div className="procedure-name">
                                  {procedure.name}
                                  {procedure.id === 'consent' && <span className="sticky-indicator"> (Always first)</span>}
                                  {procedure.platform && (
                                    <span style={{
                                      marginLeft: '0.5rem',
                                      fontSize: '0.7rem',
                                      color: '#7c3aed',
                                      background: '#ede9fe',
                                      padding: '0.125rem 0.375rem',
                                      borderRadius: '0.25rem',
                                      fontWeight: '500'
                                    }}>
                                      {procedure.platform}
                                    </span>
                                  )}
                                </div>
                                {procedure.id !== 'consent' && (
                                  <span className="drag-handle">⠿</span>
                                )}
                              </div>
                              {/* <div className="procedure-meta">
                                <span className="duration">{procedure.duration} min</span>
                                <span className={`required ${procedure.required ? 'yes' : 'no'}`}>
                                  {procedure.required ? 'Required' : 'Optional'}
                                </span>
                              </div> */}
                            </div>
  
                          </div>
                          {index < category.procedures.length - 1 && (
                            <div className="flow-connector-small">
                              
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Experiment Paradigms Section */}
      <div className="procedure-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('experiment-paradigms')}
        >
          <div className='section-toggle'>
            <span className={`toggle-arrow ${expandedSections['experiment-paradigms'] ? 'expanded' : ''}`}>
              ►
            </span>
          </div>
          <div className="section-info">
            {/* <span className="section-icon">🧪</span> */}
            <div className="section-text">
              <div className="section-name">Experiment Templates</div>
              {/* <div className="section-description">Complete experimental designs</div> */}
            </div>
          </div>
          <div className="section-toggle">
            <span className="procedure-count">
              ({Object.keys(config.paradigms || {}).length})
            </span>

          </div>
        </div>
        
        {expandedSections['experiment-paradigms'] && (
          <div className="section-content">
            <div className="paradigm-list">
              {Object.entries(config.paradigms || {}).map(([paradigmId, paradigm]) => (
                <div
                  key={paradigmId}
                  className="paradigm-item"
                  draggable
                  onDragStart={(e) => onParadigmDragStart(e, paradigmId, paradigm)}
                  style={{ borderLeft: `4px solid ${paradigm.color}` }}
                >
                  <div className="paradigm-info">
                    {/* <span className="paradigm-icon">{paradigm.icon}</span> */}
                    <div className="paradigm-text">
                      <div className="paradigm-name">{paradigm.name}</div>
                      <div className="paradigm-description">{paradigm.description}</div>
                      <div className="paradigm-meta">
                        <span className="procedure-count">
                          {paradigm.procedures.length} procedures
                        </span>
                      </div>
                    </div>
                    <span className="drag-handle">⠿</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Procedures Section */}
      <div className="procedure-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('add-procedures')}
        >
          <div className="section-toggle">
            <span className={`toggle-arrow ${expandedSections['add-procedures'] ? 'expanded' : ''}`}>
              ►
            </span>
          </div>
          <div className="section-info">
            {/* <span className="section-icon">➕</span> */}
            <div className="section-text">
              <div className="section-name">Add Test Components</div>
              {/* <div className="section-description">Create custom procedures</div> */}
            </div>
          </div>
          
        </div>
        
        {expandedSections['add-procedures'] && (
          <div className="section-content">
            <div className="add-procedure-section">
              <div className="add-procedure-info">External Test Procedures</div>
              <div className="add-procedure-description">Create custom procedure that will be executed outside the web interface</div>
          
              <button 
                className="add-procedure-btn"
                onClick={() => setShowAddProcedureForm(true)}
              >
                Add Procedure
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddProcedureForm && (
        <AddProcedureForm
          onClose={() => setShowAddProcedureForm(false)}
          onProcedureAdded={handleProcedureAdded}
          config={config}
        />
      )}
    </div>
  );
}

function ExperimentCanvas({ 
  selectedProcedures, 
  setSelectedProcedures, 
  onConfigureProcedure,
  selectedProcedureId,
  setSelectedProcedureId,
  config,
  experimentName,
  setExperimentName,
  isEditMode,
  editingExperimentId,
  setIsEditMode,
  setEditingExperimentId,
  setShowTemplateSaveWizard
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const isConfigured = (procedure) => {
    if (!procedure.configuration || Object.keys(procedure.configuration).length === 0) {
      return false;
    }
    
    // Special check for data-collection procedure
    if (procedure.id === 'data-collection') {
      const methods = procedure.configuration['collection-methods'];
      if (!methods) return false;
      // Check if at least one method is enabled
      return Object.values(methods).some(value => value === true);
    }
    
    // For other procedures, check if configuration has meaningful data
    return Object.keys(procedure.configuration).length > 0;
  };

  // Auto-enable audio when procedures that need it are added
  useEffect(() => {
    const needsAudio = shouldAutoEnableAudio(selectedProcedures);
    const dataCollectionProc = selectedProcedures.find(proc => proc.id === 'data-collection');
    
    if (dataCollectionProc) {
      const currentAudioSetting = dataCollectionProc.configuration?.['collection-methods']?.audio_ser || false;
      
      // Only update if audio needs to be enabled and isn't already
      if (needsAudio && !currentAudioSetting) {
        setSelectedProcedures(prev => prev.map(proc => {
          if (proc.id === 'data-collection') {
            return {
              ...proc,
              configuration: {
                ...proc.configuration,
                'collection-methods': {
                  ...proc.configuration['collection-methods'],
                  audio_ser: true
                }
              }
            };
          }
          return proc;
        }));
      }
    }
  }, [selectedProcedures, setSelectedProcedures]);
  // Helper function to create full procedure object from config
  const createFullProcedure = (baseProcedure, overrides = {}) => {
    return {
      id: baseProcedure.id,
      name: overrides.customName || baseProcedure.name,
      duration: baseProcedure.duration,
      customDuration: overrides.customDuration || baseProcedure.duration,
      color: baseProcedure.color,
      required: baseProcedure.required,
      platform: baseProcedure.platform,
      position: overrides.position || 0,
      instanceId: `${baseProcedure.id}_${Date.now()}${overrides.suffix || ''}`,
      configuration: overrides.preConfigured || {},
      wizardData: createLegacyWizardData(overrides.preConfigured || {})
    };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const dragData = JSON.parse(data);
        
        if (dragData.type === 'paradigm') {
          // Keep the consent form at position 0, add paradigm procedures after it
          const consentForm = selectedProcedures[0]; // Should always be consent form
          const paradigmProcedures = dragData.paradigm.procedures
            .filter(procRef => procRef.id !== 'consent') // Remove consent from paradigm
            .map((procRef, index) => {
              const baseProcedure = config.procedures[procRef.id];
              return createFullProcedure(baseProcedure, {
                ...procRef,
                suffix: `_${index}`,
                position: index + 1
              });
            });
          
          setSelectedProcedures([consentForm, ...paradigmProcedures]);
        } else if (!dragData.instanceId && dragData.id !== 'consent') {
          const newProcedure = createFullProcedure(dragData, {
            position: selectedProcedures.length
          });
          setSelectedProcedures([...selectedProcedures, newProcedure]);
        }
      } catch (error) {
        console.log(error);
      }
    }
  };

  const handleProcedureDragStart = (e, index) => {
    // Prevent dragging data collection (index 0) and consent form (index 1)
    if (index === 0 || index === 1) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index);
  };

  const handleProcedureDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleProcedureDragOver = (e, hoverIndex) => {
    e.preventDefault();
  };

  const handleProcedureDrop = (e, dropIndex) => {
  e.preventDefault();
  e.stopPropagation();
  
  const dragIndexData = e.dataTransfer.getData('text/html'); 
  const newProcedureData = e.dataTransfer.getData('text/plain');
  
  if (dragIndexData && draggedIndex !== null) {
  const dragIndex = parseInt(dragIndexData);
  
  // Prevent moving to positions 0-1 (data collection and consent positions)
  const actualDropIndex = Math.max(2, dropIndex);
  
  if (dragIndex !== actualDropIndex && dragIndex >= 2) {
    const newProcedures = [...selectedProcedures];
    const draggedItem = newProcedures[dragIndex];
    newProcedures.splice(dragIndex, 1);
    newProcedures.splice(actualDropIndex, 0, draggedItem);
    
    // Update positions to match new array order
    const updatedProcedures = newProcedures.map((proc, index) => ({
      ...proc,
      position: index
    }));
    
    setSelectedProcedures(updatedProcedures);
  }
  } else if (newProcedureData) {
    try {
      const dragData = JSON.parse(newProcedureData);
      
      if (dragData.type === 'paradigm') {
        const dataCollection = selectedProcedures[0];
        const consentForm = selectedProcedures[1];
        const paradigmProcedures = dragData.paradigm.procedures
          .filter(procRef => procRef.id !== 'consent' && procRef.id !== 'data-collection')
          .map((procRef, index) => {
            const baseProcedure = config.procedures[procRef.id];
            return createFullProcedure(baseProcedure, {
              ...procRef,
              suffix: `_${index}`,
              position: index + 2
            });
          });
        setSelectedProcedures([dataCollection, consentForm, ...paradigmProcedures]);
      } else if (!dragData.instanceId && dragData.id !== 'consent' && dragData.id !== 'data-collection') {
        const actualDropIndex = Math.max(2, dropIndex);
        const newProcedure = createFullProcedure(dragData, {
          position: actualDropIndex
        });
        
        const newProcedures = [...selectedProcedures];
        newProcedures.splice(actualDropIndex, 0, newProcedure);
        
        // Update positions for all procedures
        const updatedProcedures = newProcedures.map((proc, index) => ({
          ...proc,
          position: index
        }));
        
        setSelectedProcedures(updatedProcedures);
      }
    } catch (error) {
      console.log('Error parsing dropped procedure data:', error);
    }
  }
};

  const removeProcedure = (instanceId, index) => {
    // Prevent removing data collection (index 0) and consent form (index 1)
    if (index === 0 || index === 1) {
      return;
    }
    
    setSelectedProcedures(selectedProcedures.filter(p => p.instanceId !== instanceId));
    if (selectedProcedureId === instanceId) {
      setSelectedProcedureId(null);
    }
  };

  // const updateProcedureDuration = (instanceId, newDuration) => {
  //   const duration = parseInt(newDuration) || 0;
  //   setSelectedProcedures(prev =>
  //     prev.map(p =>
  //       p.instanceId === instanceId
  //         ? { ...p, customDuration: duration }
  //         : p
  //     )
  //   );
  // };

  const saveExperiment = async () => {
  if (!experimentName.trim()) {
    alert('Please enter an experiment name');
    return;
  }
  if (selectedProcedures.length === 0) {
    alert('Please add at least one procedure to your experiment');
    return;
  }

  // If in edit mode, show confirmation
  if (isEditMode) {
    const confirmed = window.confirm(
      `This will overwrite the existing experiment "${experimentName}".\n\nAre you sure you want to save these changes?`
    );
    if (!confirmed) return;
  }

  // Extract data collection methods from the data-collection procedure
  const dataCollectionProc = selectedProcedures.find(proc => proc.id === 'data-collection');
  const collectionMethods = dataCollectionProc?.configuration?.['collection-methods'] || {
    polar_hr: false,
    vernier_resp: false,
    emotibit: false,
    audio_ser: false
  };

  const proceduresWithCorrectPositions = selectedProcedures.map((proc, index) => ({
    ...proc,
    position: index
  }));

  const experimentData = {
    id: isEditMode ? editingExperimentId : undefined,
    name: experimentName,
    procedures: proceduresWithCorrectPositions, 
    dataCollectionMethods: collectionMethods,
    created_at: new Date().toISOString(),
    estimated_duration: selectedProcedures.reduce((total, proc) => total + (proc.customDuration || proc.duration), 0)
  };

  try {
    const endpoint = isEditMode 
      ? `/api/experiments/${editingExperimentId}` 
      : '/api/experiments';
    
    const response = await fetch(endpoint, {
      method: isEditMode ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(experimentData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(isEditMode 
        ? 'Experiment updated successfully! 🎉' 
        : 'Experiment saved successfully! 🎉'
      );
      console.log('Experiment saved with ID:', result.id);
      
      // If we were in edit mode, exit edit mode after successful save
      // if (isEditMode) {
      //   setIsEditMode(false);
      //   setEditingExperimentId(null);
       
      //   window.history.replaceState({}, document.title, window.location.pathname);
      // }
    } else {
      throw new Error(result.error || 'Failed to save experiment');
    }
  } catch (error) {
    console.error('Error saving experiment:', error);
    alert(`Error saving experiment: ${error.message}`);
  }
};

  const totalDuration = selectedProcedures.reduce((sum, p) => {
    if (!p) return sum; // Skip undefined procedures (safety check)
    const duration = p.customDuration || p.duration || 0;
    return sum + duration;
  }, 0);

  return (
    <div className="design-canvas">
      <div className="canvas-header">
        {/* <h3>Your Experiment Design</h3> */}
        <div className="header-controls">
          <input
            type="text"
            placeholder="Untitled Experiment"
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            className="experiment-name-input"
          />
          <button onClick={() => setShowTemplateSaveWizard(true)} className="save-template-btn">
            Save as Template
          </button>
          <button onClick={saveExperiment} className="save-btn">
            {isEditMode ? 'Update Experiment' : 'Save Experiment'}
          </button>
        </div>

        {selectedProcedures.length > 0 && (
          <div className="design-stats">
            {selectedProcedures.length} steps • ~{totalDuration} minutes
          </div>
        )}
      </div>

      <div
        className="canvas-drop-area"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="design-sequence">
          {selectedProcedures.map((procedure, index) => (
            <React.Fragment key={procedure.instanceId}>
              <div
                className={`design-procedure ${
                  selectedProcedureId === procedure.instanceId ? 'selected' : ''
                } ${draggedIndex === index ? 'dragging' : ''} ${
                  index === 0 || index === 1 ? 'consent-sticky' : ''
                }`}
                onClick={() => setSelectedProcedureId(procedure.instanceId)}
                
                draggable={index !== 0 && index !== 1} // Data collection and consent are not draggable
                onDragStart={(e) => handleProcedureDragStart(e, index)}
                onDragEnd={handleProcedureDragEnd}
                onDragOver={(e) => handleProcedureDragOver(e, index)}
                onDrop={(e) => handleProcedureDrop(e, index)}
              >
                <div className="procedure-number">
                  {index + 1}
                  {(index === 0 || index === 1) && <span className="sticky-indicator"> </span>}
                </div>
                <div className="procedure-content">
                  <div className="procedure-title-row">
                    <div className="procedure-title">
                    {procedure.name}
                    {procedure.platform && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        color: '#7c3aed',
                        background: '#ede9fe',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem',
                        fontWeight: '500'
                      }}>
                        ({procedure.platform})
                      </span>
                    )}
                    {procedure.id === 'data-collection' && 
                    procedure.configuration?.['collection-methods']?.audio_ser && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.7rem',
                          color: '#059669',
                          background: '#d1fae5',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem'
                        }}>
                          Audio Enabled
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="procedure-info">
                    <span className="duration-display">
                      {procedure.customDuration || procedure.duration} min
                    </span>
                    {isConfigured(procedure) && (
                      <span className="config-status-badge">
                        ✓ Configured
                      </span>
                    )}
                  </div>
                  <span className="drag-handle">⠿</span>
                </div>

                <div className="procedure-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfigureProcedure(procedure);
                    }}
                    className="config-btn"
                    title="Configure"
                  >
                    <div className="fader-icon">
                      <div className="fader"></div>
                      <div className="fader"></div>
                      <div className="fader"></div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (index !== 0 && index !== 1) {
                        removeProcedure(procedure.instanceId, index);
                      }
                    }}
                    className="remove-btn large-delete"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {/* {index < selectedProcedures.length - 1 && (
                <div className="flow-connector">
                  ↓
                </div>
              )} */}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcedureWizard({ procedure, onClose, onSave, config }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [configuration, setConfiguration] = useState(procedure.configuration || {});
  
  const steps = config?.wizardSteps?.[procedure.id] || [];
  const currentStepData = steps[currentStep];

  const validateCurrentStep = () => {
    if (procedure.id === 'consent' && currentStepData?.id === 'document') {
      const stepConfig = configuration[currentStepData.id];
      if (!stepConfig) return false;
      
      // Only validate that a link is provided
      return stepConfig.consentLink && stepConfig.consentLink.trim();
    }
    
    if (procedure.id === 'survey' && currentStepData?.id === 'survey-details') {
      const stepConfig = configuration[currentStepData.id];
      if (!stepConfig) return false;
      
      return stepConfig.surveyName && stepConfig.surveyName.trim() && 
             stepConfig.googleFormUrl && stepConfig.googleFormUrl.trim();
    }

    if (procedure.id === 'main-task' && currentStepData?.id === 'task-description') {
      const stepConfig = configuration[currentStepData.id];
      if (!stepConfig) return false;
      
      return stepConfig.conditionMarker && stepConfig.conditionMarker.trim();
    }

    if (procedure.id === 'break' && currentStepData?.id === 'media-selection') {
      const stepConfig = configuration[currentStepData.id];
      if (!stepConfig) return false;
      
      return stepConfig.selectedVideo && stepConfig.selectedVideo.trim();
    }
    
    return true; 
  };

  const updateConfiguration = (stepId, data) => {
    setConfiguration(prev => ({
      ...prev,
      [stepId]: data
    }));
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      alert('Please complete the required fields before proceeding.');
      return;
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    if (!validateCurrentStep()) {
      alert('Please complete the required fields before saving.');
      return;
    }
    onSave(configuration);
    // Small delay to ensure state updates complete before closing
    setTimeout(() => {
      onClose();
    }, 100);
  };

  if (!currentStepData) return null;

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h2>Setup: {procedure.name}</h2>
          <button onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>

        <div className="wizard-breadcrumbs">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`breadcrumb ${index === currentStep ? 'active' : ''} ${
                index < currentStep ? 'completed' : ''
              }`}
              onClick={() => setCurrentStep(index)}
            >
              <span className="breadcrumb-number">{index + 1}</span>
              <span className="breadcrumb-title">{step.title}</span>
            </div>
          ))}
        </div>

        <div className="wizard-content">
          <h3>{currentStepData.title}</h3>
          <p>{currentStepData.description}</p>
          
          <div className="step-form">
            <WizardStepContent
              stepId={currentStepData.id}
              procedureId={procedure.id}
              value={configuration[currentStepData.id]}
              configuration={configuration} 
              onChange={(data) => updateConfiguration(currentStepData.id, data)}
            />
          </div>
        </div>

        <div className="wizard-footer">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="wizard-btn secondary"
          >
            ← Previous
          </button>
          
          <span className="step-indicator">
            Step {currentStep + 1} of {steps.length}
          </span>
          
          {currentStep === steps.length - 1 ? (
            <button onClick={handleSave} className="wizard-btn primary">
              Save Configuration
            </button>
          ) : (
            <button onClick={handleNext} className="wizard-btn primary">
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AudioFileSelector({ audioSetName, selectedFile, onChange }) {
  const [availableFiles, setAvailableFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAudioFiles = async () => {
      if (!audioSetName) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/vr-room-audio/${audioSetName}`);
        
        if (response.ok) {
          const data = await response.json();
          setAvailableFiles(data.files || []);
          setError(null);
        } else {
          setError('Failed to load audio files');
          setAvailableFiles([]);
        }
      } catch (err) {
        console.error('Error fetching audio files:', err);
        setError('Error loading audio files');
        setAvailableFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAudioFiles();
  }, [audioSetName]);

  if (loading) {
    return (
      <div style={{ 
        padding: '0.5rem',
        background: '#f9fafb',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        Loading audio files...
      </div>
    );
  }

  if (error || !audioSetName) {
    return (
      <input
        type="text"
        value={selectedFile}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., 01-INST-Practice_Intro.mp3"
        style={{ 
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          fontFamily: 'monospace'
        }}
      />
    );
  }

  return (
    <select
      value={selectedFile}
      onChange={(e) => onChange(e.target.value)}
      style={{ 
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontFamily: 'monospace'
      }}
    >
      <option value="">Select an audio file...</option>
      {availableFiles.map(file => (
        <option key={file} value={file}>
          {file}
        </option>
      ))}
    </select>
  );
}

function WizardStepContent({ stepId, procedureId, value, configuration, onChange }) {
    const [showAddAudioPanel, setShowAddAudioPanel] = useState(false);
    const [additionalFilesCount, setAdditionalFilesCount] = useState(0);
    const [formData, setFormData] = useState(() => {
    const initial = value || {};
    
    // Set default duration for stressor if not already set
    if (stepId === 'duration' && procedureId === 'stressor' && !initial.duration) {
      initial.duration = '5';
    }
    
    return initial;
  });

  const handleInputChange = (key, val) => {
    const newData = { ...formData, [key]: val };
    setFormData(newData);
    onChange(newData);
  };

  useEffect(() => {
    setFormData(value || {});
  }, [stepId]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateGoogleFormUrl = (url) => {
    if (!url) return false;
    
    // Check if it's a Google Forms URL
    const googleFormsPattern = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+\/viewform/;
    return googleFormsPattern.test(url);
  };

  const renderFormFields = () => {
  switch (stepId) {
    case 'collection-methods':
      // Check if any procedures require audio
      const proceduresRequiringAudio = [];
      if (procedureId === 'data-collection' && configuration) {
        // We need access to all procedures to check which ones need audio
        // This will be passed via the wizard
        const allProcedures = configuration._allProcedures || [];
        allProcedures.forEach(proc => {
          if (procedureRequiresAudio(proc.id, proc.configuration)) {
            proceduresRequiringAudio.push(proc.name);
          }
        });
      }
      
      const audioRequired = proceduresRequiringAudio.length > 0;
      
      return (
        <div className="form-group">
          <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
            Select which sensors and data collection methods will be used throughout this experiment.
          </p>
          
          <div className="collection-methods-list">
            <label className="method-checkbox-wizard">
              <input 
                type="checkbox"
                checked={formData.polar_hr || false}
                onChange={(e) => handleInputChange('polar_hr', e.target.checked)}
              />
              <div className="method-info">
                <span className="method-name">Polar H10 Heart Rate Belt</span>
                <small>Continuous heart rate monitoring</small>
              </div>
            </label>
            
            <label className="method-checkbox-wizard">
              <input 
                type="checkbox"
                checked={formData.vernier_resp || false}
                onChange={(e) => handleInputChange('vernier_resp', e.target.checked)}
              />
              <div className="method-info">
                <span className="method-name">Vernier Respiration Belt</span>
                <small>Respiratory rate and pattern monitoring</small>
              </div>
            </label>
            
            <label className="method-checkbox-wizard">
              <input 
                type="checkbox"
                checked={formData.emotibit || false}
                onChange={(e) => handleInputChange('emotibit', e.target.checked)}
              />
              <div className="method-info">
                <span className="method-name">EmotiBit</span>
                <small>Multi-modal biometric data (HR, EDA, temperature, etc.)</small>
              </div>
            </label>
            
            <label className="method-checkbox-wizard">
              <input 
                type="checkbox"
                checked={formData.audio_ser || false}
                onChange={(e) => handleInputChange('audio_ser', e.target.checked)}
                disabled={audioRequired}
              />
              <div className="method-info">
                <span className="method-name">
                  Audio Recording / Speech Emotion Recognition
                  {audioRequired && <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>*Required</span>}
                </span>
                <small>Voice recording and emotion analysis</small>
              </div>
            </label>
          </div>
        </div>
      );
      
    case 'survey-method':
      if (procedureId === 'demographics') {
        return (
          <div className="form-group">
            <label>Demographics Survey Method</label>
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="surveyMethod"
                  value="external"
                  checked={formData.surveyMethod === 'external'}
                  onChange={(e) => handleInputChange('surveyMethod', e.target.value)}
                />
                External Link (opens in new window)
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="surveyMethod"
                  value="google_embedded"
                  checked={formData.surveyMethod === 'google_embedded'}
                  onChange={(e) => handleInputChange('surveyMethod', e.target.value)}
                />
                Google Forms (embedded with autofill)
              </label>
            </div>
            <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
              Choose whether to open the survey in a new window or embed it with participant information pre-filled.
            </small>
          </div>
        );
      }
      return null;

    case 'survey-link':
      if (procedureId === 'demographics') {
        const isGoogleEmbedded = configuration['survey-method']?.surveyMethod === 'google_embedded';
        
        return (
          <div className="form-group">
            {isGoogleEmbedded ? (
              <>
                <label>Google Forms URL (with pre-fill parameters) *</label>
                <input 
                  type="url"
                  placeholder="https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?usp=pp_url&entry.123456789=SampleID"
                  value={formData.googleFormUrl || ''}
                  onChange={(e) => handleInputChange('googleFormUrl', e.target.value)}
                  className="wizard-input-full wizard-mb-sm"
                />
                
                {formData.googleFormUrl && !validateGoogleFormUrl(formData.googleFormUrl) && (
                  <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    ⚠️ Please enter a valid Google Forms URL that includes the pre-filled parameters
                  </div>
                )}
                
                {formData.googleFormUrl && validateGoogleFormUrl(formData.googleFormUrl) && (
                  <div style={{ color: '#059669', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    ✅ Valid Google Forms URL detected
                  </div>
                )}
                
                <small className="wizard-help-text">
                  Paste the complete pre-filled URL from Google Forms. It should contain "SampleID" as the placeholder for subject information.
                </small>
              </>
            ) : (
              <>
                <label>External Survey Link *</label>
                <input 
                  type="url"
                  placeholder="https://example.com/demographics-survey"
                  value={formData.externalLink || ''}
                  onChange={(e) => handleInputChange('externalLink', e.target.value)}
                  className="wizard-input-full wizard-mb-sm"
                />
                <small className="wizard-help-text">
                  This link will be opened in a new window when the Demographics Survey procedure begins.
                </small>
              </>
            )}
          </div>
        );
      }
      return null;

    case 'media-selection':
      const videoOptions = [
        { value: 'neutral_1', label: 'Neutral 1 - Calm Street Scene', duration: '5 min' },
        { value: 'neutral_2', label: 'Neutral 2 - Calm Street Scene', duration: '5 min' },
      ];

      return (
        <div className="form-group">
          <label>Select Break Video</label>
          <select
            value={formData.selectedVideo || ''}
            onChange={(e) => handleInputChange('selectedVideo', e.target.value)}
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            <option value="">Choose a video...</option>
            {videoOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.duration})
              </option>
            ))}
          </select>
          
          {formData.selectedVideo && (
            <div style={{ 
              background: '#f8fafc', 
              padding: '1rem', 
              borderRadius: '0.5rem', 
              marginTop: '0.5rem' 
            }}>
              <p><strong>Selected Video:</strong></p>
              <p>{videoOptions.find(v => v.value === formData.selectedVideo)?.label}</p>
              <p><strong>Duration:</strong> {videoOptions.find(v => v.value === formData.selectedVideo)?.duration}</p>
            </div>
          )}
          
          <small style={{ color: '#666', display: 'block', marginTop: '0.5rem' }}>
            This video will be played during the break period to help participants relax.
          </small>
          
          <div style={{ 
            background: '#eff6ff', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            border: '1px solid #bfdbfe',
            marginTop: '1rem'
          }}>
            <p><strong>Video Options:</strong></p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
              <li><strong>Neutral 1:</strong> Calming nature scenes with soft background music</li>
              <li><strong>Neutral 2:</strong> Abstract geometric patterns with ambient sounds</li>
              <li><strong>Neutral 3:</strong> Gentle water flow with natural sounds</li>
            </ul>
          </div>
        </div>
      );

    case 'setup-instructions':
      if (procedureId === 'demographics') {
        const isGoogleEmbedded = configuration['survey-method']?.surveyMethod === 'google_embedded';
        
        if (!isGoogleEmbedded) {
          return (
            <div className="form-group">
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                This step is only needed for Google Forms with autofill integration.
              </p>
            </div>
          );
        }
        
        return (
          <div className="form-group">
            <div className="setup-instructions">
              <h4>Google Forms Autofill Setup Instructions</h4>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                <p><strong>To enable autofill integration with your experimental platform:</strong></p>
                <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                  <li>Open your Google Form and click the hamburger icon in the top right corner</li>
                  <li>Choose "Pre-fill form"</li>
                  <li>In the field where you want the subject identifier to appear, enter: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>SampleID</code></li>
                  <li>Click <strong>"Get link"</strong> and copy the generated URL</li>
                  <li>The URL should end with something like: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>entry.123456789=SampleID</code></li>
                </ol>
              </div>
              
              <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
                <p><strong>⚠️ Important:</strong></p>
                <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
                  <li>The placeholder <code>SampleID</code> will be automatically replaced with the actual subject's information</li>
                  <li>Make sure your form fields are properly configured to accept pre-filled values</li>
                  <li>Test the form with the generated URL before using it in your experiment</li>
                </ul>
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div className="form-group">
          <div className="setup-instructions">
            <h4>Google Forms Autofill Setup Instructions</h4>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <p><strong>To enable autofill integration with your experimental platform:</strong></p>
              <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                <li>Open your Google Form and click the <strong>Send</strong> button</li>
                <li>Click the <strong>Link</strong> tab (🔗)</li>
                <li>Click <strong>"Get pre-filled link"</strong></li>
                <li>In the field where you want the subject identifier to appear, enter: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>SampleID</code></li>
                <li>Click <strong>"Get link"</strong> and copy the generated URL</li>
                <li>The URL should end with something like: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>entry.123456789=SampleID</code></li>
              </ol>
            </div>
            
            <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
              <p><strong>⚠️ Important:</strong></p>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
                <li>The placeholder <code>SampleID</code> will be automatically replaced with the actual subject's information</li>
                <li>Make sure your form fields are properly configured to accept pre-filled values</li>
                <li>Test the form with the generated URL before using it in your experiment</li>
              </ul>
            </div>
          </div>
        </div>
      );

    case 'survey-details':
      return (
        <div className="form-group">
          <label>Survey Name *</label>
          <input 
            type="text"
            placeholder="e.g., PSS-10, STAI, Custom Questionnaire"
            value={formData.surveyName || ''}
            onChange={(e) => handleInputChange('surveyName', e.target.value)}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <small style={{ color: '#666', display: 'block', marginBottom: '1rem' }}>
            This name will be used to identify the survey in your experiment data.
          </small>

          <label>Google Forms URL *</label>
          <input 
            type="url"
            placeholder="https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?usp=pp_url&entry.123456789=SampleID"
            value={formData.googleFormUrl || ''}
            onChange={(e) => handleInputChange('googleFormUrl', e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          
          {formData.googleFormUrl && !validateGoogleFormUrl(formData.googleFormUrl) && (
            <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              ⚠️ Please enter a valid Google Forms URL that includes the pre-filled parameters
            </div>
          )}
          
          {formData.googleFormUrl && validateGoogleFormUrl(formData.googleFormUrl) && (
            <div style={{ color: '#059669', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              ✅ Valid Google Forms URL detected
            </div>
          )}
          
          <small style={{ color: '#666', display: 'block' }}>
            Paste the complete pre-filled URL from Google Forms. It should contain "SampleID" as the placeholder for subject information.
          </small>
        </div>
      );

    case 'validation':
      if (procedureId === 'demographics') {
        const surveyMethod = formData['survey-method']?.surveyMethod;
        const isGoogleEmbedded = surveyMethod === 'google_embedded';
        
        return (
          <div className="form-group">
            <h4>Configuration Summary</h4>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <p><strong>Survey Name:</strong> Demographics Survey</p>
              <p><strong>Method:</strong> {isGoogleEmbedded ? 'Google Forms (Embedded)' : 'External Link'}</p>
              
              {isGoogleEmbedded ? (
                <>
                  <p><strong>Google Forms URL:</strong></p>
                  <code style={{ 
                    display: 'block', 
                    background: '#e2e8f0', 
                    padding: '0.5rem', 
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    marginBottom: '1rem'
                  }}>
                    {formData['survey-link']?.googleFormUrl || 'Not specified'}
                  </code>
                </>
              ) : (
                <>
                  <p><strong>External Link:</strong></p>
                  <code style={{ 
                    display: 'block', 
                    background: '#e2e8f0', 
                    padding: '0.5rem', 
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    marginBottom: '1rem'
                  }}>
                    {formData['survey-link']?.externalLink || 'Not specified'}
                  </code>
                </>
              )}
            </div>
            
            <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
              <p><strong>Next Steps:</strong></p>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
                {isGoogleEmbedded ? (
                  <>
                    <li>The survey will be embedded in the experiment interface</li>
                    <li>Participant information will be automatically filled when they access the form</li>
                    <li>Responses will be collected in your Google Forms response spreadsheet</li>
                  </>
                ) : (
                  <>
                    <li>The survey link will open in a new window when the procedure begins</li>
                    <li>Participants will need to complete the survey in the external window</li>
                    <li>The subject interface will also be launched showing the participant form</li>
                  </>
                )}
                <li>You can update these settings later by reconfiguring this procedure</li>
              </ul>
            </div>
          </div>
        );
      }
      
      return (
        <div className="form-group">
          <h4>Configuration Summary</h4>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
            <p><strong>Survey Name:</strong> {formData['survey-details']?.surveyName || 'Not specified'}</p>
            <p><strong>Google Forms URL:</strong></p>
            <code style={{ 
              display: 'block', 
              background: '#e2e8f0', 
              padding: '0.5rem', 
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              wordBreak: 'break-all',
              marginBottom: '1rem'
            }}>
              {formData['survey-details']?.googleFormUrl || 'Not specified'}
            </code>
          </div>
          
          <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
            <p><strong>Next Steps:</strong></p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
              <li>Your survey will be embedded in the experiment interface</li>
              <li>Subject information will be automatically filled when participants access the form</li>
              <li>Responses will be collected in your Google Forms response spreadsheet</li>
              <li>You can update these settings later by reconfiguring this procedure</li>
            </ul>
          </div>
        </div>
      );

      case 'session-type-selection':
        if (procedureId === 'vr-room-task') {
          return (
            <div className="form-group">
              <label>VR Room Task Session Type</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="sessionType"
                    value="practice"
                    checked={formData.sessionType === 'practice'}
                    onChange={(e) => handleInputChange('sessionType', e.target.value)}
                  />
                  <div>
                    <div>Practice Session</div>
                    <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                      Initial practice walking session (no room exposure)
                    </small>
                  </div>
                </label>
                
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="sessionType"
                    value="first_room"
                    checked={formData.sessionType === 'first_room'}
                    onChange={(e) => handleInputChange('sessionType', e.target.value)}
                  />
                  <div>
                    <div>First Room Session</div>
                    <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                      First exposure to a VR room (uses "This is the first room" audio)
                    </small>
                  </div>
                </label>
                
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="sessionType"
                    value="subsequent_room"
                    checked={formData.sessionType === 'subsequent_room'}
                    onChange={(e) => handleInputChange('sessionType', e.target.value)}
                  />
                  <div>
                    <div>Subsequent Room Session</div>
                    <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                      Additional room exposures (uses "This is the next room" audio)
                    </small>
                  </div>
                </label>
              </div>
            </div>
          );
        }
        break;

    case 'audio-set-selection':
      if (procedureId === 'vr-room-task') {
        // Check if audio was already uploaded in another VR Room Task procedure
        const allProcedures = configuration._allProcedures || [];
        const existingVRRoomTask = allProcedures.find(proc => 
          proc.id === 'vr-room-task' && 
          proc.configuration?.['audio-set-selection']?.audioSet
        );

        // Auto-populate if audio exists from another procedure
// Only populate if we haven't already set audioSet AND files haven't been uploaded in THIS wizard instance
if (existingVRRoomTask && !value?.audioSet && !value?.customAudioSetName) {
  const existingConfig = existingVRRoomTask.configuration['audio-set-selection'];
  const updatedData = {
    ...formData,
    audioSet: existingConfig.audioSet,
    customAudioSetName: existingConfig.audioSet,
    filesUploaded: true,
    uploadedFileCount: existingConfig.uploadedFileCount || 0,
    configUploaded: existingConfig.configUploaded || false
  };
  if (existingConfig.sequenceConfig) {
    updatedData.sequenceConfig = existingConfig.sequenceConfig;
  }
  setFormData(updatedData);
  onChange(updatedData);
}

        const audioAlreadyUploaded = existingVRRoomTask && existingVRRoomTask.configuration?.['audio-set-selection']?.filesUploaded;

        return (
          <div className="form-group">
            {audioAlreadyUploaded ? (
              <>
                <div style={{ 
                  padding: '1.5rem', 
                  background: '#d1fae5', 
                  borderRadius: '0.5rem',
                  border: '2px solid #059669',
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#059669', fontSize: '1rem' }}>
                    ✓ Audio Already Uploaded
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#065f46' }}>
                    Audio set "<strong>{formData.customAudioSetName || formData.audioSet}</strong>" with {(formData.uploadedFileCount || 0) + additionalFilesCount} files is already available.
                    {formData.configUploaded && ' Configuration file was also uploaded.'}
                  </p>
                </div>
                
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  <p>This VR Room Task will use the same audio files as the previous VR Room Task procedure.</p>
                  <p>You can still customize the sequence in the next step.</p>
                </div>
              </>
            ) : (
              <>
                <label>VR Room Task Audio Set</label>
                <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Upload your custom audio files. These files will be <strong>shared across all VR Room Task procedures</strong> in this experiment. Optionally upload a configuration file for <strong>this specific VR room procedure</strong>, or build the sequence manually in the next step.
                </p>
                
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  background: '#f0f9ff', 
                  border: '1px solid #0ea5e9',
                  borderRadius: '0.5rem' 
                }}>
                  <h4 style={{ marginTop: 0 }}>Upload Custom Audio Files</h4>
                  <p style={{ fontSize: '0.875rem', color: '#0369a1', marginBottom: '1rem' }}>
                    Upload your audio files to create a new audio set.
                  </p>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Audio Set Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., vr_room_custom_1, student_protocol_a"
                      onChange={(e) => handleInputChange('customAudioSetName', e.target.value)}
                      value={formData.customAudioSetName || ''}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    />
                    <small style={{ color: '#64748b' }}>
                      Use lowercase with underscores (e.g., vr_room_custom_1)
                    </small>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Select Audio Files (MP3/WAV) *
                    </label>
                    <input
                      type="file"
                      accept=".mp3,.wav"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        if (files.length === 0) return;
                        
                        const audioSetName = formData.customAudioSetName;
                        if (!audioSetName || !audioSetName.trim()) {
                          alert('Please enter an audio set name first');
                          e.target.value = '';
                          return;
                        }
                        
                        const formDataObj = new FormData();
                        formDataObj.append('audioSetName', audioSetName);
                        files.forEach(file => {
                          formDataObj.append('audioFiles', file);
                        });
                        
                        try {
                          const response = await fetch('/api/upload-vr-room-audio', {
                            method: 'POST',
                            body: formDataObj
                          });
                          
                          const result = await response.json();
                          if (response.ok && result.success) {
                            alert(`Successfully uploaded ${files.length} files to ${audioSetName}`);
                            const updatedData = {
                              ...formData,
                              audioSet: audioSetName,
                              customAudioSetName: audioSetName,
                              filesUploaded: true,
                              uploadedFileCount: files.length
                            };
                            console.log('Setting audio upload data:', updatedData);
                            setFormData(updatedData);
                            onChange(updatedData);
                          } else {
                            alert(`Upload failed: ${result.error || 'Unknown error'}`);
                          }
                        } catch (error) {
                          console.error('Upload error:', error);
                          alert('Error uploading files. Please try again.');
                        }
                        
                        e.target.value = '';
                      }}
                      style={{ width: '100%' }}
                    />
                    {formData.filesUploaded && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        background: '#d1fae5',
                        border: '2px solid #059669',
                        borderRadius: '0.375rem',
                        color: '#059669',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        ✓ {formData.uploadedFileCount} audio files uploaded successfully
                      </div>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Configuration File (JSON) - Optional
                    </label>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      <strong>Important:</strong> This config file applies to <strong>this VR room procedure only</strong>. 
                      Each VR Room Task procedure can have its own unique configuration using the same shared audio files.
                    </p>
                    <input
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        
                        const audioSetName = formData.customAudioSetName;
                        if (!audioSetName || !audioSetName.trim()) {
                          alert('Please enter an audio set name first');
                          e.target.value = '';
                          return;
                        }
                        
                        const formDataObj = new FormData();
                        formDataObj.append('audioSetName', audioSetName);
                        formDataObj.append('configFile', file);
                        
                        try {
                          const response = await fetch('/api/upload-vr-room-config', {
                            method: 'POST',
                            body: formDataObj
                          });
                          
                          const result = await response.json();
                          if (response.ok && result.success) {
                            alert('Configuration file uploaded successfully');
                            const updatedData = {
                              ...formData,
                              sequenceConfig: result.config,
                              configUploaded: true
                            };
                            console.log('Setting config data:', updatedData);
                            console.log('Config has steps:', result.config?.steps?.length);
                            setFormData(updatedData);
                            onChange(updatedData);
                          } else {
                            alert(`Upload failed: ${result.error || 'Unknown error'}`);
                          }
                        } catch (error) {
                          console.error('Upload error:', error);
                          alert('Error uploading configuration. Please try again.');
                        }
                        
                        e.target.value = '';
                      }}
                      style={{ width: '100%' }}
                    />
                    {formData.configUploaded && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        background: '#d1fae5',
                        border: '2px solid #059669',
                        borderRadius: '0.375rem',
                        color: '#059669',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        ✓ Configuration uploaded ({formData.sequenceConfig.steps?.length || 0} steps)
                      </div>
                    )}
                    {!formData.configUploaded && (
                      <small style={{ color: '#64748b', display: 'block', marginTop: '0.5rem' }}>
                        Skip this to build your sequence manually in the next step
                      </small>
                    )}
                  </div>
                  
                  <div style={{ 
                    background: '#fef3c7', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem',
                    border: '1px solid #f59e0b' 
                  }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', fontSize: '0.875rem' }}>
                      File Naming Convention:
                    </p>
                    <ul style={{ 
                      margin: 0, 
                      paddingLeft: '1.5rem', 
                      fontSize: '0.75rem',
                      lineHeight: '1.5' 
                    }}>
                      <li><code>01-INST-Practice_Intro.mp3</code> - Instruction audio</li>
                      <li><code>02-INST-Practice_Repeat.mp3</code> - Next instruction</li>
                      <li><code>12-Q1-Anxiety_Rating.mp3</code> - Question requiring recording</li>
                      <li><code>16-INST-Wait_For_Instructions.mp3</code> - Final instruction</li>
                    </ul>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem' }}>
                      Files should follow your sequence. Upload config.json to pre-define the sequence, or build it manually in the next step.
                    </p>
                  </div>
                </div>
              </>
            )}

            {(formData.filesUploaded || (existingVRRoomTask?.configuration?.['audio-set-selection']?.filesUploaded)) && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddAudioPanel(prev => !prev)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f0f9ff',
                    color: '#0369a1',
                    border: '1px solid #0ea5e9',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem'
                  }}
                >
                  {showAddAudioPanel ? 'Cancel' : '+ Add Audio Files'}
                </button>

                {showAddAudioPanel && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '1rem',
                    background: '#f0f9ff',
                    border: '1px solid #0ea5e9',
                    borderRadius: '0.5rem'
                  }}>
                    <h4 style={{ marginTop: 0 }}>Add Audio Files</h4>
                    <p style={{ fontSize: '0.875rem', color: '#0369a1', marginBottom: '1rem' }}>
                      Select additional files to add to the audio set. Existing files with the same name will be overwritten.
                    </p>
                    <input
                      type="file"
                      accept=".mp3,.wav"
                      multiple
                      style={{ width: '100%', marginBottom: '0.75rem' }}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        if (files.length === 0) return;

                        const audioSetName = formData.customAudioSetName || formData.audioSet;
                        if (!audioSetName) {
                          alert('No audio set found. Please ensure audio has been configured first.');
                          e.target.value = '';
                          return;
                        }

                        const formDataObj = new FormData();
                        formDataObj.append('audioSetName', audioSetName);
                        files.forEach(file => formDataObj.append('audioFiles', file));

                        try {
                          const response = await fetch('/api/upload-vr-room-audio', {
                            method: 'POST',
                            body: formDataObj
                          });
                          const result = await response.json();
                          if (response.ok && result.success) {
                            alert(`Successfully added ${files.length} file(s) to "${audioSetName}"`);
                            setAdditionalFilesCount(prev => prev + files.length);
                            setShowAddAudioPanel(false);
                          } else {
                            alert(`Upload failed: ${result.error || 'Unknown error'}`);
                          }
                        } catch (error) {
                          console.error('Upload error:', error);
                          alert('Error uploading files. Please try again.');
                        }

                        e.target.value = '';
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }
      break;

    case 'sequence-editor':
      if (procedureId === 'vr-room-task') {
        const sessionType = configuration['session-type-selection']?.sessionType || 'practice';
        const audioSetConfig = configuration['audio-set-selection'];
        
        // Check if config was uploaded
        const hasUploadedConfig = audioSetConfig?.configUploaded && audioSetConfig?.sequenceConfig;
        
        // Get the full config - either from upload or create empty structure
        let fullConfig = hasUploadedConfig 
          ? audioSetConfig.sequenceConfig 
          : { steps: [] };
        
        // Success message if config was uploaded
        const uploadSuccessMessage = hasUploadedConfig ? (
          <div style={{ 
            padding: '1.5rem', 
            background: '#d1fae5', 
            borderRadius: '0.5rem',
            border: '2px solid #059669',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#059669', fontSize: '1rem' }}>
              ✓ Configuration File Uploaded
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#065f46' }}>
              Your config file has been loaded with <strong>{fullConfig.steps.length} steps</strong> defined. 
              You can proceed to the next step, or use the editor below to make adjustments.
            </p>
          </div>
        ) : (
          <div style={{ 
            padding: '1.5rem', 
            background: '#eff6ff', 
            borderRadius: '0.5rem',
            border: '2px solid #3b82f6',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#1e40af', fontSize: '1rem' }}>
              Build Your Sequence
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e3a8a' }}>
              No configuration file was uploaded. Use the editor below to build your sequence from scratch.
            </p>
          </div>
        );
        
        // Filter steps based on session type if we have uploaded config
        const allSteps = fullConfig.steps || [];
        const relevantStepIndices = hasUploadedConfig 
          ? allSteps
              .map((step, index) => ({ step, originalIndex: index }))
              .filter(({ step }) => step.sessionTypes && step.sessionTypes.includes(sessionType))
              .map(({ originalIndex }) => originalIndex)
          : []; // Empty for manual building
        
        // Initialize form data with config if not already set
        if (!formData.editableConfig || (formData.editableConfig.steps && formData.editableConfig.steps.length === 0 && hasUploadedConfig)) {
          handleInputChange('editableConfig', {
            steps: hasUploadedConfig ? [...allSteps] : (formData.editableConfig?.steps || []),
            relevantIndices: hasUploadedConfig ? relevantStepIndices : (formData.editableConfig?.relevantIndices || [])
          });
        }
        
        const editableSteps = formData.editableConfig?.steps || [];
        const relevantIndices = formData.editableConfig?.relevantIndices || [];
        
        // For manual building, we show all steps (relevantIndices = all indices)
        const displayIndices = hasUploadedConfig 
          ? relevantIndices 
          : editableSteps.map((_, idx) => idx);
        
        const updateStep = (originalIndex, field, value) => {
          const newSteps = [...editableSteps];
          newSteps[originalIndex] = {
            ...newSteps[originalIndex],
            [field]: value
          };
          handleInputChange('editableConfig', {
            steps: newSteps,
            relevantIndices: hasUploadedConfig ? relevantIndices : newSteps.map((_, idx) => idx)
          });
        };
        
        const addStep = () => {
          const newStep = {
            stepType: "timeout",
            sessionTypes: [sessionType],
            timeout: 10,
            beepBefore: false,
            beepAfter: false,
            recording: false
          };
          
          const newSteps = [...editableSteps, newStep];
          const newIndices = hasUploadedConfig 
            ? [...relevantIndices, newSteps.length - 1]
            : newSteps.map((_, idx) => idx);
          
          handleInputChange('editableConfig', {
            steps: newSteps,
            relevantIndices: newIndices
          });
        };
        
        const removeStep = (originalIndex) => {
          const newSteps = editableSteps.filter((_, i) => i !== originalIndex);
          const newIndices = hasUploadedConfig
            ? relevantIndices
                .filter(i => i !== originalIndex)
                .map(i => i > originalIndex ? i - 1 : i)
            : newSteps.map((_, idx) => idx);
          
          handleInputChange('editableConfig', {
            steps: newSteps,
            relevantIndices: newIndices
          });
        };
        
        const moveStep = (originalIndex, direction) => {
          const currentPos = displayIndices.indexOf(originalIndex);
          if (
            (direction === 'up' && currentPos === 0) ||
            (direction === 'down' && currentPos === displayIndices.length - 1)
          ) {
            return;
          }
          
          if (hasUploadedConfig) {
            // For uploaded config, swap in relevantIndices
            const newIndices = [...relevantIndices];
            const swapPos = direction === 'up' ? currentPos - 1 : currentPos + 1;
            [newIndices[currentPos], newIndices[swapPos]] = [newIndices[swapPos], newIndices[currentPos]];
            
            handleInputChange('editableConfig', {
              steps: editableSteps,
              relevantIndices: newIndices
            });
          } else {
            // For manual building, actually swap steps in array
            const newSteps = [...editableSteps];
            const swapPos = direction === 'up' ? currentPos - 1 : currentPos + 1;
            [newSteps[currentPos], newSteps[swapPos]] = [newSteps[swapPos], newSteps[currentPos]];
            
            handleInputChange('editableConfig', {
              steps: newSteps,
              relevantIndices: newSteps.map((_, idx) => idx)
            });
          }
        };
        
        return (
          <div className="form-group">
            {uploadSuccessMessage}
            <div style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <h4 style={{ margin: 0 }}>Sequence Editor</h4>
                <p style={{ color: '#666', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                  {hasUploadedConfig 
                    ? `Editing ${sessionType} session (${displayIndices.length} steps)` 
                    : `Building sequence for ${sessionType} session (${editableSteps.length} steps)`}
                </p>
              </div>
            </div>
            
            {editableSteps.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: '#f9fafb',
                border: '2px dashed #d1d5db',
                borderRadius: '0.5rem'
              }}>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  No steps yet. Click "Add Step" to start building your sequence.
                </p>
              </div>
            ) : (
              <div style={{ 
                maxHeight: '500px', 
                overflowY: 'auto', 
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem',
                background: '#f9fafb'
              }}>
                {displayIndices.map((originalIndex, displayIndex) => {
                  const step = editableSteps[originalIndex];
                  const isRecording = step.recording || step.stepType === 'recording';
                  const isTimeout = step.stepType === 'timeout';
                  
                  return (
                    <div
                      key={originalIndex}
                      style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        background: isRecording ? '#fef3c7' : '#ffffff',
                        borderRadius: '0.5rem',
                        border: `2px solid ${isRecording ? '#f59e0b' : '#e2e8f0'}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* Step Header */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            fontWeight: '700', 
                            fontSize: '1.125rem',
                            color: '#1f2937'
                          }}>
                            Step {displayIndex + 1}
                          </span>
                          {isRecording && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              background: '#f59e0b', 
                              color: 'white',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontWeight: '600'
                            }}>
                              RECORDING
                            </span>
                          )}
                          {isTimeout && !step.file && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              background: '#6b7280', 
                              color: 'white',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontWeight: '600'
                            }}>
                              TIMEOUT
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => moveStep(originalIndex, 'up')}
                            disabled={displayIndex === 0}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: displayIndex === 0 ? '#e5e7eb' : '#f3f4f6',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.25rem',
                              cursor: displayIndex === 0 ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(originalIndex, 'down')}
                            disabled={displayIndex === displayIndices.length - 1}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: displayIndex === displayIndices.length - 1 ? '#e5e7eb' : '#f3f4f6',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.25rem',
                              cursor: displayIndex === displayIndices.length - 1 ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(originalIndex)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600'
                            }}
                            title="Delete step"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      
                      {/* Step Type Selector */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '0.875rem', 
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.25rem'
                        }}>
                          Step Type
                        </label>
                        <select
                          value={step.file ? 'audio' : step.stepType}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newSteps = [...editableSteps];
                            
                            if (value === 'audio') {
                              newSteps[originalIndex] = {
                                ...newSteps[originalIndex],
                                file: newSteps[originalIndex].file || 'new-file.mp3',
                                stepType: undefined
                              };
                            } else {
                              newSteps[originalIndex] = {
                                ...newSteps[originalIndex],
                                file: undefined,
                                stepType: value
                              };
                            }
                            
                            handleInputChange('editableConfig', {
                              steps: newSteps,
                              relevantIndices: hasUploadedConfig ? relevantIndices : newSteps.map((_, idx) => idx)
                            });
                          }}
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem'
                          }}
                        >
                          <option value="audio">Audio File</option>
                          <option value="timeout">Wait Period (during subject activity)</option>
                          <option value="recording">Recording Period</option>
                        </select>
                      </div>
                      
                      {/* Audio File Input */}
                      {(step.file !== undefined && step.stepType !== 'timeout' && step.stepType !== 'recording') && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '0.875rem', 
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '0.25rem'
                          }}>
                            Audio File
                          </label>
                          <AudioFileSelector
                            audioSetName={audioSetConfig?.customAudioSetName}
                            selectedFile={step.file || ''}
                            onChange={(file) => updateStep(originalIndex, 'file', file)}
                          />
                        </div>
                      )}
                      
                      {/* Configuration Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(2, 1fr)', 
                        gap: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        {/* Timeout */}
                        <div>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            color: '#6b7280',
                            marginBottom: '0.25rem'
                          }}>
                            Timeout (seconds)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={step.timeout || 0}
                            onChange={(e) => updateStep(originalIndex, 'timeout', parseInt(e.target.value) || 0)}
                            style={{ 
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem'
                            }}
                          />
                          <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                            {step.file ? 'Wait after audio' : 'Wait duration'}
                          </small>
                        </div>
                        
                        {/* Recording Duration */}
                        {isRecording && (
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '0.75rem', 
                              fontWeight: '600',
                              color: '#6b7280',
                              marginBottom: '0.25rem'
                            }}>
                              Recording Duration (s)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={step.recordingDuration || 90}
                              onChange={(e) => updateStep(originalIndex, 'recordingDuration', parseInt(e.target.value) || 90)}
                              style={{ 
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem'
                              }}
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Checkboxes */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(2, 1fr)', 
                        gap: '0.5rem'
                      }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={step.beepBefore || false}
                            onChange={(e) => updateStep(originalIndex, 'beepBefore', e.target.checked)}
                            style={{ marginRight: '0.375rem' }}
                          />
                          Beep Before
                        </label>
                        
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={step.beepAfter || false}
                            onChange={(e) => updateStep(originalIndex, 'beepAfter', e.target.checked)}
                            style={{ marginRight: '0.375rem' }}
                          />
                          Beep After
                        </label>
                      </div>
                      
                      {/* Warning Beep for Recordings */}
                      {isRecording && step.recordingDuration > 30 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            color: '#6b7280',
                            marginBottom: '0.25rem'
                          }}>
                            Warning Beep At (seconds)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={step.recordingDuration - 1}
                            value={step.warningBeepAt || Math.max(0, (step.recordingDuration || 90) - 15)}
                            onChange={(e) => updateStep(originalIndex, 'warningBeepAt', parseInt(e.target.value) || 0)}
                            placeholder="e.g., 75"
                            style={{ 
                              width: '150px',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem'
                            }}
                          />
                          <small style={{ color: '#6b7280', fontSize: '0.7rem', marginLeft: '0.5rem' }}>
                            Optional warning before recording ends
                          </small>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Summary */}
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '0.5rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', fontSize: '0.875rem' }}>
                Sequence Summary:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', lineHeight: '1.6' }}>
                <li>{editableSteps.filter(s => s.file).length} audio file steps</li>
                <li>{editableSteps.filter(s => s.stepType === 'timeout').length} timeout-only steps</li>
                <li>{editableSteps.filter(s => s.stepType === 'recording').length} recording steps</li>
                {/* <li>Total duration: ~{editableSteps.reduce((sum, s) => sum + (s.timeout || 0) + (s.recordingDuration || 0), 0)} seconds</li> */}
              </ul>
            </div>
            
            {/* Add Step Button at Bottom */}
            <div style={{ 
              marginTop: '1.5rem', 
              textAlign: 'center',
              paddingTop: '1rem',
              borderTop: '2px solid #e2e8f0'
            }}>
              <button
                type="button"
                onClick={addStep}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}
              >
                + Add Step
              </button>
            </div>
          </div>
        );
      }
      break;

    case 'task-description':
      if (procedureId === 'vr-room-task') {
        return (
          <div className="form-group">
            <label className="wizard-mt">Experimental Condition Marker *</label>
            <input 
              type="text"
              placeholder="e.g., vr_room_baseline, vr_room_nature, vr_room_urban"
              value={formData.conditionMarker || ''}
              onChange={(e) => handleInputChange('conditionMarker', e.target.value)}
              className="wizard-input-full wizard-mb-sm"
            />
            <small className="wizard-help-text-mb">
              This condition marker will be used to identify the experimental condition for this VR room task.
            </small>

            <div className="wizard-highlight-box">
              <p><strong>Examples of VR room condition markers:</strong></p>
              <ul className="wizard-list-small">
                <li><code className="wizard-code">vr_room_baseline</code> - baseline VR environment</li>
                <li><code className="wizard-code">vr_room_nature</code> - natural environment room</li>
                <li><code className="wizard-code">vr_room_urban</code> - urban environment room</li>
                <li><code className="wizard-code">vr_room_neutral</code> - neutral grey room</li>
              </ul>
            </div>
            
            <label className="wizard-mt">Task Notes (Optional)</label>
            <textarea
              placeholder="Add any additional notes about this VR room task configuration..."
              value={formData.taskNotes || ''}
              onChange={(e) => handleInputChange('taskNotes', e.target.value)}
              className="wizard-input-full"
              rows="3"
            />
          </div>
        );
      }
      return null;
    case 'question-set':
      if(procedureId === 'ser-baseline'){
        return (
          <div className="form-group">
            <label>SER Question Set</label>
            <div className="radio-group">
              {[
                { value: 'ser_1', label: 'SER 1 - Standard baseline questions' },
                { value: 'ser_2', label: 'SER 2 - Extended baseline questions' },
                { value: 'ser_3', label: 'SER 3 - Emotional baseline questions' }
              ].map(option => (
                <label key={option.value} className="radio-label">
                  <input 
                    type="radio" 
                    name="questionSet"
                    value={option.value}
                    checked={formData.questionSet === option.value}
                    onChange={(e) => handleInputChange('questionSet', e.target.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            
            {/* <label className="checkbox-label" style={{ marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={formData.enableDetailedInstructions || false}
                onChange={(e) => handleInputChange('enableDetailedInstructions', e.target.checked)}
              />
              Show detailed instructions to participants
            </label> */}
          </div>
        );
      } else if (procedureId === 'main-task'){
          return (
            <div className="form-group">
              <label>Main Task Question Set</label>
              <div className="radio-group">
                {[
                  { value: 'main_task_1', label: 'Main Task 1 - Standard question set' },
                  { value: 'main_task_2', label: 'Main Task 2 - Alternative question set' },
                  { value: 'main_task_3', label: 'Main Task 3 - Extended question set' }
                ].map(option => (
                  <label key={option.value} className="radio-label">
                    <input 
                      type="radio" 
                      name="questionSet"
                      value={option.value}
                      checked={formData.questionSet === option.value}
                      onChange={(e) => handleInputChange('questionSet', e.target.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              
              {/* Audio File Upload Section */}
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1rem', 
                background: '#f0f9ff', 
                border: '1px solid #0ea5e9',
                borderRadius: '0.5rem' 
              }}>
                <h4 style={{ marginTop: 0 }}>Upload Custom Audio Files</h4>
                <p style={{ fontSize: '0.875rem', color: '#0369a1', marginBottom: '1rem' }}>
                  Upload a new set of audio files for this task. Files will be available as a new question set option.
                </p>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Question Set Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., main_task_4, custom_room_task"
                    onChange={(e) => handleInputChange('customQuestionSetName', e.target.value)}
                    value={formData.customQuestionSetName || ''}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <small style={{ color: '#64748b' }}>
                    This name will identify your custom question set (use lowercase with underscores)
                  </small>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Select Audio Files
                  </label>
                  <input
                    type="file"
                    accept=".mp3,.wav"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files);
                      if (files.length === 0) return;
                      
                      const questionSetName = formData.customQuestionSetName;
                      if (!questionSetName || !questionSetName.trim()) {
                        alert('Please enter a question set name first');
                        e.target.value = '';
                        return;
                      }
                      
                      const formDataObj = new FormData();
                      formDataObj.append('questionSetName', questionSetName);
                      files.forEach(file => {
                        formDataObj.append('audioFiles', file);
                      });
                      
                      try {
                        const response = await fetch('/api/upload-main-task-audio', {
                          method: 'POST',
                          body: formDataObj
                        });
                        
                        const result = await response.json();
                        if (response.ok && result.success) {
                          alert(`Successfully uploaded ${files.length} files to ${questionSetName}`);
                          handleInputChange('questionSet', questionSetName);
                        } else {
                          alert(`Upload failed: ${result.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Upload error:', error);
                        alert('Error uploading files. Please try again.');
                      }
                      
                      e.target.value = '';
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div style={{ 
                  background: '#fef3c7', 
                  padding: '0.75rem', 
                  borderRadius: '0.375rem',
                  border: '1px solid #f59e0b' 
                }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', fontSize: '0.875rem' }}>
                    Required File Naming Convention:
                  </p>
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '1.5rem', 
                    fontSize: '0.75rem',
                    lineHeight: '1.5' 
                  }}>
                    <li><code>1-Intro.mp3</code> - Introduction audio</li>
                    <li><code>2-PreQuestions.mp3</code> - Post-observation instructions</li>
                    <li><code>3-Q1.mp3</code> - First question</li>
                    <li><code>4-Q2.mp3</code> - Second question</li>
                    <li><code>5-Q3.mp3</code> - Third question (and so on...)</li>
                    <li><code>Wait_For_Instructions.mp3</code> - Final instructions</li>
                  </ul>
                  <p style={{ 
                    margin: '0.5rem 0 0 0', 
                    fontSize: '0.75rem', 
                    fontStyle: 'italic' 
                  }}>
                    File prefixes must be numbered sequentially (1-, 2-, 3-, 4-, etc.). Question files (starting with prefix 3+) must contain "Q1", "Q2", "Q3" in the filename.
                  </p>
                </div>
              </div>
              
              <label className="wizard-mt">Experimental Condition Marker *</label>
              <input 
                type="text"
                placeholder="e.g., main_task_baseline, main_task_treatment_a, main_task_condition_1"
                value={formData.conditionMarker || ''}
                onChange={(e) => handleInputChange('conditionMarker', e.target.value)}
                className="wizard-input-full wizard-mb-sm"
              />
            <small className="wizard-help-text-mb">
              This condition marker will be used to identify the experimental condition for this main task.
            </small>

            {/* <label className="checkbox-label wizard-mt">
              <input 
                type="checkbox" 
                checked={formData.allowConditionOverride || false}
                onChange={(e) => handleInputChange('allowConditionOverride', e.target.checked)}
              />
              Allow experimenter to override condition during test execution
            </label> */}
            
            {/* <label className="checkbox-label" style={{ marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={formData.enableDetailedInstructions || false}
                onChange={(e) => handleInputChange('enableDetailedInstructions', e.target.checked)}
              />
              Show detailed instructions to participants
            </label> */}
          </div>
        );
      } else {
        return (
          <div className="form-group">
            <label>PRS Question Set</label>
            <div className="radio-group">
              {[
                { value: 'prs_1', label: 'PRS 1 - Standard question set' },
                { value: 'prs_2', label: 'PRS 2 - Alternative question set' },
                { value: 'prs_3', label: 'PRS 3 - Extended question set' }
              ].map(option => (
                <label key={option.value} className="radio-label">
                  <input 
                    type="radio" 
                    name="questionSet"
                    value={option.value}
                    checked={formData.questionSet === option.value}
                    onChange={(e) => handleInputChange('questionSet', e.target.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            
            <label className="wizard-mt">Experimental Condition Marker *</label>
            <input 
              type="text"
              placeholder="e.g., prs_baseline, prs_post_nature, prs_post_urban"
              value={formData.conditionMarker || ''}
              onChange={(e) => handleInputChange('conditionMarker', e.target.value)}
              className="wizard-input-full wizard-mb-sm"
            />
            <small className="wizard-help-text-mb">
              This condition marker will be used to identify the experimental condition for this PRS task. It will be passed to the setCondition function during experiment execution.
            </small>

            <div className="wizard-highlight-box">
              <p><strong>Examples of PRS condition markers:</strong></p>
              <ul className="wizard-list-small">
                <li><code className="wizard-code">prs_baseline</code> - for baseline PRS measurements</li>
                <li><code className="wizard-code">prs_post_nature</code> - for PRS after nature exposure</li>
                <li><code className="wizard-code">prs_post_urban</code> - for PRS after urban exposure</li>
                <li><code className="wizard-code">prs_control</code> - for control condition PRS</li>
              </ul>
            </div>

            {/* <label className="checkbox-label wizard-mt">
              <input 
                type="checkbox" 
                checked={formData.allowConditionOverride || false}
                onChange={(e) => handleInputChange('allowConditionOverride', e.target.checked)}
              />
              Allow experimenter to override condition during test execution
            </label> */}
            
            {/* <label className="checkbox-label" style={{ marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={formData.enableDetailedInstructions || false}
                onChange={(e) => handleInputChange('enableDetailedInstructions', e.target.checked)}
              />
              Show detailed instructions to participants
            </label> */}
          </div>
        );
      }

    case 'psychopy-setup':
    return (
      <div className="form-group">
        <label className="checkbox-label">
          <input 
            type="checkbox" 
            checked={formData.usePsychoPy || false}
            onChange={(e) => handleInputChange('usePsychoPy', e.target.checked)}
          />
          Perform this task in external software
        </label>
        <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          When checked, participants will be directed to switch to different software to complete this task.
        </small>
        
        {formData.usePsychoPy && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
            <label>Select External Platform *</label>
            <select
              value={formData.platform || 'PsychoPy'}
              onChange={(e) => handleInputChange('platform', e.target.value)}
              style={{ width: '100%', marginTop: '0.5rem', marginBottom: '1rem' }}
            >
              <option value="PsychoPy">PsychoPy</option>
              <option value="OpenSesame">OpenSesame</option>
              <option value="jsPsych">jsPsych</option>
              <option value="E-Prime">E-Prime</option>
              <option value="Inquisit">Inquisit</option>
              <option value="Gorilla">Gorilla</option>
              <option value="lab.js">lab.js</option>
              <option value="PsyToolkit">PsyToolkit</option>
              <option value="Other">Other</option>
            </select>
            <small style={{ color: '#666', display: 'block', marginBottom: '1rem' }}>
              Select the platform where this procedure will be executed
            </small>
          </div>
        )}
      </div>
    );

    case 'task-setup':
      return (
        <div className="form-group">
          <label>SART Task Configuration</label>
          <div className="radio-group">
            <label className="radio-label">
              <input 
                type="radio" 
                name="sartVersion"
                value="standard"
                checked={formData.sartVersion === 'standard'}
                onChange={(e) => handleInputChange('sartVersion', e.target.value)}
              />
              Standard SART (digits 1-9, withhold response to 3)
            </label>
            <label className="radio-label">
              <input 
                type="radio" 
                name="sartVersion"
                value="custom"
                checked={formData.sartVersion === 'custom'}
                onChange={(e) => handleInputChange('sartVersion', e.target.value)}
              />
              Custom SART configuration
            </label>
          </div>
          
          {formData.sartVersion === 'custom' && (
            <div style={{ marginTop: '1rem' }}>
              <label>Target Digit (digit to withhold response)</label>
              <input 
                type="number" 
                min="0" 
                max="9"
                value={formData.targetDigit || '3'}
                onChange={(e) => handleInputChange('targetDigit', e.target.value)}
                style={{ width: '100px', marginTop: '0.5rem' }}
              />
            </div>
          )}
        </div>
      );
        
    case 'stressor-type':
      const stressorTypes = [
        'Mental Arithmetic Task',
        'Time Pressure Task'
      ];
      return (
        <div className="form-group">
          <label>Stressor Type</label>
          {stressorTypes.map(stressor => (
            <label key={stressor} className="radio-label">
              <input 
                type="radio" 
                name="stressorType"
                value={stressor}
                checked={formData.stressorType === stressor}
                onChange={(e) => handleInputChange('stressorType', e.target.value)}
              />
              {stressor}
            </label>
          ))}
          
          {formData.stressorType === 'Mental Arithmetic Task' && (
            <div className="mat-config" style={{ marginTop: '1rem' }}>
              <label>Select Question Set</label>
              <div className="radio-group">
                {[
                  { value: 'mat_1', label: 'Test 1 - Subtract 13 from 1,009', description: 'Standard difficulty' },
                  { value: 'mat_2', label: 'Test 2 - Subtract 17 from 1,059', description: 'Higher difficulty' },
                  { value: 'mat_practice', label: 'Practice Test - Subtract 5 from 20', description: 'Warmup for participants' }
                ].map(option => (
                  <label key={option.value} className="radio-label">
                    <input 
                      type="radio" 
                      name="matQuestionSet"
                      value={option.value}
                      checked={formData.matQuestionSet === option.value}
                      onChange={(e) => handleInputChange('matQuestionSet', e.target.value)}
                    />
                    <div>
                      <div>{option.label}</div>
                      <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                        {option.description}
                      </small>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="wizard-info-box" style={{ marginTop: '1rem' }}>
                <p><strong>About MAT Question Sets:</strong></p>
                <ul className="wizard-list-small">
                  <li><strong>Practice Test:</strong> Easier task to familiarize participants with the procedure</li>
                  <li><strong>Test 1:</strong> Standard difficulty for most experiments</li>
                  <li><strong>Test 2:</strong> More challenging, suitable for stress induction studies</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      );
          
    case 'document':
      return (
        <div className="form-group">
          <label>External Consent Form Link *</label>
          <input 
            type="url" 
            placeholder="https://example.com/consent-form"
            value={formData.consentLink || ''}
            onChange={(e) => handleInputChange('consentLink', e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <small style={{ color: '#666', display: 'block', marginBottom: '1rem' }}>
            Enter the full URL to your external consent form. This will be opened in a separate window for the participant to review.
          </small>

          {/* <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={formData.requireSignature || false}
              onChange={(e) => handleInputChange('requireSignature', e.target.checked)}
            />
            Require digital signature/acknowledgment
          </label> */}
        </div>
      );

    case 'file-upload':
      return (
        <div className="form-group">
          <label>Upload Survey PDF Files</label>
          <input type="file" accept=".pdf" multiple />
        </div>
      );

    case 'order':
      return (
        <div className="form-group">
          <label>Question Randomization</label>
          <div className="radio-group">
            {[
              { value: 'fixed', label: 'Fixed order (questions appear in set sequence)' },
              { value: 'randomize', label: 'Randomize all questions' },
              { value: 'partial', label: 'Randomize within sections' }
            ].map(option => (
              <label key={option.value} className="radio-label">
                <input 
                  type="radio" 
                  name="questionOrder"
                  value={option.value}
                  checked={formData.questionOrder === option.value}
                  onChange={(e) => handleInputChange('questionOrder', e.target.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          
          <label>Branching Logic</label>
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={formData.enableBranching || false}
              onChange={(e) => handleInputChange('enableBranching', e.target.checked)}
            />
            Enable conditional questions (branching based on previous answers)
          </label>
          
          <label>Response Format</label>
          <div className="radio-group">
            {[
              { value: 'single_page', label: 'All questions on one page' },
              { value: 'multi_page', label: 'One question per page' },
              { value: 'sections', label: 'Group questions into sections' }
            ].map(option => (
              <label key={option.value} className="radio-label">
                <input 
                  type="radio" 
                  name="responseFormat"
                  value={option.value}
                  checked={formData.responseFormat === option.value}
                  onChange={(e) => handleInputChange('responseFormat', e.target.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      );
        
    // case 'task-description':
    //   const taskTypes = ['Cognitive Task', 'Physical Task', 'VR Task', 'Audio Task'];
    //   return (
    //     <div className="form-group">
    //       <label>Select Task</label>
    //       {taskTypes.map(task => (
    //         <label key={task} className="checkbox-label">
    //           <input 
    //             type="checkbox" 
    //             checked={formData.selectedTasks?.includes(task) || false}
    //             onChange={(e) => {
    //               const current = formData.selectedTasks || [];
    //               const updated = e.target.checked 
    //                 ? [...current, task]
    //                 : current.filter(t => t !== task);
    //               handleInputChange('selectedTasks', updated);
    //             }}
    //           />
    //           {task}
    //         </label>
    //       ))}
          
    //       <label className="wizard-mt">Experimental Condition Marker *</label>
    //       <input 
    //         type="text"
    //         placeholder="e.g., control, treatment, high_stress, low_stress"
    //         value={formData.conditionMarker || ''}
    //         onChange={(e) => handleInputChange('conditionMarker', e.target.value)}
    //         className="wizard-input-full wizard-mb-sm"
    //       />
    //       <small className="wizard-help-text-mb">
    //         This condition marker will be used to identify the experimental condition for this task. It will be passed to the setCondition function during experiment execution.
    //       </small>

    //       <div className="wizard-highlight-box">
    //         <p><strong>Examples of condition markers:</strong></p>
    //         <ul className="wizard-list-small">
    //           <li><code className="wizard-code">control</code> - for control group participants</li>
    //           <li><code className="wizard-code">treatment_A</code> - for first treatment condition</li>
    //           <li><code className="wizard-code">high_cognitive_load</code> - for high difficulty tasks</li>
    //           <li><code className="wizard-code">visual_stimuli</code> - for visual presentation conditions</li>
    //         </ul>
    //       </div>

    //       {/* <label className="checkbox-label wizard-mt">
    //         <input 
    //           type="checkbox" 
    //           checked={formData.allowConditionOverride || false}
    //           onChange={(e) => handleInputChange('allowConditionOverride', e.target.checked)}
    //         />
    //         Allow experimenter to override condition during test execution
    //       </label>
    //       <small className="wizard-help-text-mt">
    //         When checked, experimenters can manually change the condition marker before starting this task.
    //       </small> */}
    //     </div>
    //   );

    // case 'sensors':
    //   const sensorTypes = ['Heart Rate (HR)', 'Electroencephalography (EEG)', 'Electrodermal Activity (EDA)', 'Respiration', 'Eye Tracking'];
    //   return (
    //     <div className="form-group">
    //       <label>Select Sensors</label>
    //       {sensorTypes.map(sensor => (
    //         <label key={sensor} className="checkbox-label">
    //           <input 
    //             type="checkbox" 
    //             checked={formData.selectedSensors?.includes(sensor) || false}
    //             onChange={(e) => {
    //               const current = formData.selectedSensors || [];
    //               const updated = e.target.checked 
    //                 ? [...current, sensor]
    //                 : current.filter(s => s !== sensor);
    //               handleInputChange('selectedSensors', updated);
    //             }}
    //           />
    //           {sensor}
    //         </label>
    //       ))}
    //     </div>
    //   );
    
    case 'duration':
      if (procedureId === 'stressor') {
        return (
          <div className="form-group">
            <label>Task Duration (minutes)</label>
            <input 
              type="number" 
              value={formData.duration || ''}
              onChange={(e) => handleInputChange('duration', e.target.value)}
              min="1"
              max="60"
              placeholder="5"
            />
            <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
              Default: 5 minutes. Specify a custom duration to override the default for the Mental Arithmetic Task.
            </small>
          </div>
        );
      }
    
      return (
        <div className="form-group">
          <label>Duration (minutes)</label>
          <input 
            type="number" 
            value={formData.duration || ''}
            onChange={(e) => handleInputChange('duration', e.target.value)}
            min="1"
            max="120"
          />
        </div>
      );
    
    default:
      return (
        <div className="form-group">
          {/* <label>Configuration Notes</label>
          <textarea 
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Add configuration details for this step..."
            rows={4}
          /> */}
        </div>
      );
  }
};

  return (
    <div className="wizard-step-content">
      {renderFormFields()}
    </div>
  );
}

function ExperimentBuilder({ onBack }) {
  const [experimentName, setExperimentName] = useState('');
  const [selectedProcedures, setSelectedProcedures] = useState([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState(null);
  const [currentWizardProcedure, setCurrentWizardProcedure] = useState(null);
  
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showTemplateSaveWizard, setShowTemplateSaveWizard] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingExperimentId, setEditingExperimentId] = useState(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  
  const initializedRef = useRef(false);
  const editIdRef = useRef(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/experiment-config');
      if (!response.ok) {
        throw new Error('Failed to load experiment configuration');
      }
      const configData = await response.json();
      setConfig(configData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading config:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadExperimentForEdit = async (experimentId) => {
    setIsLoadingEdit(true);
    try {
      const response = await fetch(`/api/experiments/${experimentId}`);
      if (!response.ok) {
        throw new Error('Failed to load experiment');
      }
      const experiment = await response.json();
      
      setIsEditMode(true);
      setEditingExperimentId(experimentId);
      setExperimentName(experiment.name);
      
      const reconstructedProcedures = experiment.procedures.map(proc => ({
        ...proc,
        instanceId: proc.instanceId || `${proc.id}_${Date.now()}_${Math.random()}`
      }));

      const hasDataCollection = reconstructedProcedures.some(p => p.id === 'data-collection');
      if (!hasDataCollection) {
        reconstructedProcedures.unshift(createDataCollectionProcedure());
      }

      setSelectedProcedures(reconstructedProcedures);
      initializedRef.current = true;
      
    } catch (error) {
      console.error('Error loading experiment for edit:', error);
      alert('Failed to load experiment for editing. Returning to runner.');
      window.history.back();
    } finally {
      setIsLoadingEdit(false);
    }
  };

  useEffect(() => {
    if (!initializedRef.current && config && selectedProcedures.length === 0 && !editIdRef.current) {
      setSelectedProcedures([
        createDataCollectionProcedure(),
        createInitialConsentProcedure(config)
      ]);
      initializedRef.current = true;
    }
  }, [config, selectedProcedures.length]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId && config && editId !== editIdRef.current && !isLoadingEdit) {
      editIdRef.current = editId;
      loadExperimentForEdit(editId);
    }
    
    if (!editId && editIdRef.current) {
      editIdRef.current = null;
      if (selectedProcedures.length > 2) {
        const confirmReset = window.confirm('Reset to new experiment?');
        if (confirmReset) {
          setSelectedProcedures([
            createDataCollectionProcedure(),
            createInitialConsentProcedure(config)
          ]);
          setExperimentName('');
          setIsEditMode(false);
          setEditingExperimentId(null);
          initializedRef.current = false;
        }
      }
    }
  }, [config, isLoadingEdit, selectedProcedures.length]);

  const handleDragStart = (e, procedure) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(procedure));
  };

  const handleParadigmDragStart = (e, paradigmId, paradigm) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'paradigm',
      paradigmId,
      paradigm
    }));
  };

  const handleConfigureProcedure = (procedure) => {
      // Pass all procedures for detection logic (data-collection needs it for audio, vr-room-task needs it for detecting existing uploads)
      if (procedure.id === 'data-collection' || procedure.id === 'vr-room-task') {
        const enrichedProcedure = {
          ...procedure,
          configuration: {
            ...procedure.configuration,
            _allProcedures: selectedProcedures
          }
        };
        setCurrentWizardProcedure(enrichedProcedure);
      } else {
        setCurrentWizardProcedure(procedure);
      }
    };

  const handleWizardSave = (configuration) => {
    const { _allProcedures, ...cleanConfiguration } = configuration;  // strip it
    setSelectedProcedures(prev =>
      prev.map(p => {
        if (p.instanceId === currentWizardProcedure.instanceId) {
          let customDuration = p.customDuration || p.duration;
          if (cleanConfiguration.duration && cleanConfiguration.duration.duration) {
            customDuration = parseInt(cleanConfiguration.duration.duration);
          }
          return { 
            ...p, 
            configuration: cleanConfiguration,
            customDuration,
            wizardData: {
              ...p.wizardData,
              rawConfiguration: cleanConfiguration
            }
          };
        }
        return p;
      })
    );
  };

  // Function to handle template save
  const handleTemplateSave = async (templateData) => {
    if (selectedProcedures.length === 0) {
      alert('Please add at least one procedure to your template');
      return;
    }

    // Filter out data-collection from procedures
    const templateProcedures = selectedProcedures
      .filter(proc => proc.id !== 'data-collection')
      .map((proc, index) => ({
        id: proc.id,
        position: index,
        customName: proc.name !== config.procedures[proc.id]?.name ? proc.name : undefined,
        customDuration: proc.customDuration !== proc.duration ? proc.customDuration : undefined,
        preConfigured: Object.keys(proc.configuration || {}).length > 0 ? proc.configuration : undefined
      }));

    // If using existing category, send just the category key
    // If creating new category, send the new name
    const categoryToSend = templateData.useExistingCategory 
      ? templateData.category  // This will be like 'priming', 'dual-task', etc.
      : templateData.category.toLowerCase().replace(/\s+/g, '-');  // Convert "New Category" to "new-category"

    const template = {
      name: templateData.name,
      description: templateData.description || `Experimental paradigm: ${templateData.name}`,
      category: categoryToSend,
      color: templateData.color || '#8B5CF6',
      procedures: templateProcedures
    };

    try {
      const response = await fetch('/api/save-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('Template saved successfully! 🎉');
        // Reload config to show new template
        await loadConfig();
        setShowTemplateSaveWizard(false);
      } else {
        throw new Error(result.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert(`Error saving template: ${error.message}`);
    }
  };

  const handleProcedureAdded = (newProcedure) => {
    // Update config state directly without reloading from file
    setConfig(prevConfig => {
      if (!prevConfig) return prevConfig;
      
      return {
        ...prevConfig,
        procedures: {
          ...prevConfig.procedures,
          [newProcedure.id]: newProcedure
        },
        wizardSteps: {
          ...prevConfig.wizardSteps,
          [newProcedure.id]: [
            {
              id: 'psychopy-setup',
              title: 'PsychoPy Setup',
              description: 'Configure PsychoPy integration options'
            },
            {
              id: 'task-description',
              title: 'Task Configuration',
              description: 'Define task parameters and settings'
            }
          ]
        }
      };
    });
  };

  if (loading || isLoadingEdit) {
    return (
      <div className="experiment-builder">
        <div className="builder-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Home
          </button>
          <h1>Experiment Builder</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading experiment configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="experiment-builder">
        <div className="builder-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Home
          </button>
          <h1>Experiment Builder</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
          <p>Error loading configuration: {error}</p>
          <p>Please check that experiment-config.json is available in your public folder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="experiment-builder">
      <div className="builder-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Home
        </button>
        <h1>Experiment Builder</h1>
      </div>

      <div className="builder-layout">
        <ExampleExperimentView 
          onDragStart={handleDragStart}
          onParadigmDragStart={handleParadigmDragStart}
          config={config}
          onProcedureAdded={handleProcedureAdded}
        />
        <ExperimentCanvas
          selectedProcedures={selectedProcedures}
          setSelectedProcedures={setSelectedProcedures}
          onConfigureProcedure={handleConfigureProcedure}
          selectedProcedureId={selectedProcedureId}
          setSelectedProcedureId={setSelectedProcedureId}
          config={config}
          experimentName={experimentName}
          setExperimentName={setExperimentName}
          isEditMode={isEditMode}
          editingExperimentId={editingExperimentId}
          setIsEditMode={setIsEditMode}
          setEditingExperimentId={setEditingExperimentId}
          setShowTemplateSaveWizard={setShowTemplateSaveWizard}
        />
      </div>

      {currentWizardProcedure && (
        <ProcedureWizard
          procedure={currentWizardProcedure}
          onClose={() => setCurrentWizardProcedure(null)}
          onSave={handleWizardSave}
          config={config}
        />
      )}

      {showTemplateSaveWizard && (
        <TemplateSaveWizard
          onClose={() => setShowTemplateSaveWizard(false)}
          onSave={handleTemplateSave}
          config={config}
        />
      )}
    </div>
  );
}

export default ExperimentBuilder;