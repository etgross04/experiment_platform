import React, { useState, useEffect, useRef } from 'react';
import './ExperimentBuilder.css';

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
      position: 0,
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
    position: 0,
    instanceId: `consent_${Date.now()}`,
    configuration: {},
    wizardData: createLegacyWizardData({})
  };
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

function AddProcedureForm({ onClose, onProcedureAdded, config }) {
  const [formData, setFormData] = useState({
    name: '',
    duration: 15,
    category: '',
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
          <h2>Add PsychoPy Procedure</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="wizard-content">
          <h3>Create Custom PsychoPy Procedure</h3>
          <p>Add a new PsychoPy procedure to your library</p>
          
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

function ExampleExperimentView({ onDragStart, onParadigmDragStart, config, onRefreshConfig }) {
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
    // Refresh the config to show the new procedure
    onRefreshConfig();
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
              <div className="add-procedure-info">PsychoPy Procedures</div>
              <div className="add-procedure-description">Create custom PsychoPy procedures that will be executed outside the web interface</div>
          
              <button 
                className="add-procedure-btn"
                onClick={() => setShowAddProcedureForm(true)}
              >
                Add PsychoPy Procedure
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
  setExperimentName
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Helper function to create full procedure object from config
  const createFullProcedure = (baseProcedure, overrides = {}) => {
    return {
      id: baseProcedure.id,
      name: overrides.customName || baseProcedure.name,
      duration: baseProcedure.duration,
      customDuration: overrides.customDuration || baseProcedure.duration,
      color: baseProcedure.color,
      required: baseProcedure.required,
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
    // Prevent dragging the consent form (index 0)
    if (index === 0) {
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
      
      // Prevent moving to position 0 (consent form position)
      const actualDropIndex = Math.max(1, dropIndex);
      
      if (dragIndex !== actualDropIndex && dragIndex !== 0) { // Can't move consent form
        const newProcedures = [...selectedProcedures];
        const draggedItem = newProcedures[dragIndex];
        newProcedures.splice(dragIndex, 1);
        newProcedures.splice(actualDropIndex, 0, draggedItem);
        setSelectedProcedures(newProcedures);
      }
    } else if (newProcedureData) {
      try {
        const dragData = JSON.parse(newProcedureData);
        
        if (dragData.type === 'paradigm') {
          // Keep consent form, replace everything else with paradigm
          const consentForm = selectedProcedures[0];
          const paradigmProcedures = dragData.paradigm.procedures
            .filter(procRef => procRef.id !== 'consent')
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
          const actualDropIndex = Math.max(1, dropIndex);
          const newProcedures = [...selectedProcedures];
          newProcedures.splice(actualDropIndex, 0, newProcedure);
          setSelectedProcedures(newProcedures);
        }
      } catch (error) {
        console.log('Error parsing dropped procedure data:', error);
      }
    }
  };

  const removeProcedure = (instanceId, index) => {
    // Prevent removing the consent form (index 0)
    if (index === 0) {
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

    const experimentData = {
      name: experimentName,
      procedures: selectedProcedures,
      created_at: new Date().toISOString(),
      estimated_duration: selectedProcedures.reduce((total, proc) => total + (proc.customDuration || proc.duration), 0)
    };

    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(experimentData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('Experiment saved successfully! 🎉');
        console.log('Experiment saved with ID:', result.id);
        // No reset - user can continue editing or save variations
      } else {
        throw new Error(result.error || 'Failed to save experiment');
      }
    } catch (error) {
      console.error('Error saving experiment:', error);
      alert(`Error saving experiment: ${error.message}`);
    }
  };

  const totalDuration = selectedProcedures.reduce((sum, p) => sum + (p.customDuration || p.duration), 0);

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
          <button onClick={saveExperiment} className="save-btn">
            Save Experiment
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
                  index === 0 ? 'consent-sticky' : ''
                }`}
                onClick={() => setSelectedProcedureId(procedure.instanceId)}
                style={{ borderLeft: `4px solid ${procedure.color}` }}
                draggable={index !== 0} // Consent form is not draggable
                onDragStart={(e) => handleProcedureDragStart(e, index)}
                onDragEnd={handleProcedureDragEnd}
                onDragOver={(e) => handleProcedureDragOver(e, index)}
                onDrop={(e) => handleProcedureDrop(e, index)}
              >
                <div className="procedure-number">
                  {index + 1}
                  {index === 0 && <span className="sticky-indicator"> </span>}
                </div>
                <div className="procedure-content">
                  <div className="procedure-title-row">
                    <div className="procedure-title">{procedure.name}</div>
                  </div>
                  <div className="procedure-info">
                    <span className="duration-display">
                      {procedure.customDuration || procedure.duration} min
                    </span>
                    {/* <span className={`config-status ${
                      Object.keys(procedure.configuration || {}).length > 0 ? 'configured' : 'not-configured'
                    }`}>
                      {Object.keys(procedure.configuration || {}).length > 0 ? '✅ Configured' : '⚙️ Needs setup'}
                    </span> */}
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
                      if (index !== 0) {
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
      
      if (stepConfig.consentMethod === 'upload') {
        return stepConfig.consentFile; // PDF file must be uploaded
      } else if (stepConfig.consentMethod === 'link') {
        return stepConfig.consentLink && stepConfig.consentLink.trim(); // URL must be provided
      } else {
        return false; // Must select a method
      }
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
    onClose();
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

function WizardStepContent({ stepId, procedureId, value, configuration, onChange }) {
  const [formData, setFormData] = useState(value || {});

  const handleConsentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      alert('Please upload a valid PDF file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('experiment_name', procedureId); 

    try {
      const response = await fetch('/api/upload-consent-form', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        handleInputChange('consentFile', file.name);
        handleInputChange('consentFilePath', result.filePath);
        alert('Consent form uploaded successfully!');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    }
  };

  const handleInputChange = (key, val) => {
    const newData = { ...formData, [key]: val };
    setFormData(newData);
    onChange(newData);
  };

  const validateGoogleFormUrl = (url) => {
    if (!url) return false;
    
    // Check if it's a Google Forms URL
    const googleFormsPattern = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+\/viewform/;
    return googleFormsPattern.test(url);
  };

  const renderFormFields = () => {
  switch (stepId) {
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
                  placeholder="https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?usp=pp_url&entry.123456789=Sample+ID"
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
                  Paste the complete pre-filled URL from Google Forms. It should contain "Sample+ID" as the placeholder for subject information.
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
        { value: 'neutral_1', label: 'Neutral 1 - Calm Nature Scenes', duration: '5 min' },
        { value: 'neutral_2', label: 'Neutral 2 - Abstract Patterns', duration: '5 min' },
        { value: 'neutral_3', label: 'Neutral 3 - Gentle Water Flow', duration: '5 min' }
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
                  <li>Open your Google Form and click the <strong>Send</strong> button</li>
                  <li>Click the <strong>Link</strong> tab (🔗)</li>
                  <li>Click <strong>"Get pre-filled link"</strong></li>
                  <li>In the field where you want the subject identifier to appear, enter: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>Sample+ID</code></li>
                  <li>Click <strong>"Get link"</strong> and copy the generated URL</li>
                  <li>The URL should end with something like: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>entry.123456789=Sample+ID</code></li>
                </ol>
              </div>
              
              <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
                <p><strong>⚠️ Important:</strong></p>
                <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
                  <li>The placeholder <code>Sample+ID</code> will be automatically replaced with the actual subject's information</li>
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
                <li>In the field where you want the subject identifier to appear, enter: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>Sample+ID</code></li>
                <li>Click <strong>"Get link"</strong> and copy the generated URL</li>
                <li>The URL should end with something like: <code style={{ background: '#e2e8f0', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>entry.123456789=Sample+ID</code></li>
              </ol>
            </div>
            
            <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
              <p><strong>⚠️ Important:</strong></p>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '0' }}>
                <li>The placeholder <code>Sample+ID</code> will be automatically replaced with the actual subject's information</li>
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
          <label>📋 Survey Name *</label>
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
            placeholder="https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?usp=pp_url&entry.123456789=Sample+ID"
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
            Paste the complete pre-filled URL from Google Forms. It should contain "Sample+ID" as the placeholder for subject information.
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
            
            <label className="checkbox-label" style={{ marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={formData.enableDetailedInstructions || false}
                onChange={(e) => handleInputChange('enableDetailedInstructions', e.target.checked)}
              />
              Show detailed instructions to participants
            </label>
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

            <label className="checkbox-label wizard-mt">
              <input 
                type="checkbox" 
                checked={formData.allowConditionOverride || false}
                onChange={(e) => handleInputChange('allowConditionOverride', e.target.checked)}
              />
              Allow experimenter to override condition during test execution
            </label>
            
            <label className="checkbox-label" style={{ marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={formData.enableDetailedInstructions || false}
                onChange={(e) => handleInputChange('enableDetailedInstructions', e.target.checked)}
              />
              Show detailed instructions to participants
            </label>
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

            <label className="checkbox-label wizard-mt">
              <input 
                type="checkbox" 
                checked={formData.allowConditionOverride || false}
                onChange={(e) => handleInputChange('allowConditionOverride', e.target.checked)}
              />
              Allow experimenter to override condition during test execution
            </label>
            
            <label className="checkbox-label" style={{ marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={formData.enableDetailedInstructions || false}
                onChange={(e) => handleInputChange('enableDetailedInstructions', e.target.checked)}
              />
              Show detailed instructions to participants
            </label>
          </div>
        );
      }
    
    case 'instructions':
      return (
        <div className="form-group">
          <label>Additional Instructions</label>
          <textarea 
            value={formData.additionalInstructions || ''}
            onChange={(e) => handleInputChange('additionalInstructions', e.target.value)}
            placeholder="Enter any additional instructions for participants..."
            rows={4}
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            These instructions will be shown before the PRS task begins.
          </small>
        </div>
      );

    case 'psychopy-setup':
      return (
        <div className="form-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={formData.usePsychoPy || false}
              onChange={(e) => handleInputChange('usePsychoPy', e.target.checked)}
            />
            Perform this task in PsychoPy
          </label>
          <small style={{ color: '#666', display: 'block', marginTop: '8px' }}>
            When checked, participants will be directed to switch to PsychoPy to complete this task.
          </small>
          
          {formData.usePsychoPy && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
              <label>Task Instructions for Participants</label>
              <textarea 
                value={formData.psychopyInstructions || ''}
                onChange={(e) => handleInputChange('psychopyInstructions', e.target.value)}
                placeholder="Enter any specific instructions for participants about this PsychoPy task..."
                rows={3}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
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
          <label>Consent Form Method</label>
          <div className="radio-group">
            <label className="radio-label">
              <input 
                type="radio" 
                name="consentMethod"
                value="upload"
                checked={formData.consentMethod === 'upload'}
                onChange={(e) => handleInputChange('consentMethod', e.target.value)}
              />
              Upload PDF File
            </label>
            <label className="radio-label">
              <input 
                type="radio" 
                name="consentMethod"
                value="link"
                checked={formData.consentMethod === 'link'}
                onChange={(e) => handleInputChange('consentMethod', e.target.value)}
              />
              External Link
            </label>
          </div>

          {formData.consentMethod === 'upload' && (
            <div className="upload-section">
              <label>Upload Consent Document (PDF)</label>
              <input 
                type="file" 
                accept=".pdf"
                onChange={(e) => handleConsentUpload(e)}
              />
              {formData.consentFile && (
                <div className="file-status">
                  ✅ File uploaded: {formData.consentFile}
                </div>
              )}
            </div>
          )}

          {formData.consentMethod === 'link' && (
            <div className="link-section">
              <label>External Consent Form Link</label>
              <input 
                type="url" 
                placeholder="https://example.com/consent-form"
                value={formData.consentLink || ''}
                onChange={(e) => handleInputChange('consentLink', e.target.value)}
              />
              <small>Enter the full URL to your external consent form</small>
            </div>
          )}

          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={formData.requireSignature || false}
              onChange={(e) => handleInputChange('requireSignature', e.target.checked)}
            />
            Require digital signature/acknowledgment
          </label>
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
        
    case 'task-description':
      const taskTypes = ['Cognitive Task', 'Physical Task', 'VR Task', 'Audio Task'];
      return (
        <div className="form-group">
          <label>Select Task</label>
          {taskTypes.map(task => (
            <label key={task} className="checkbox-label">
              <input 
                type="checkbox" 
                checked={formData.selectedTasks?.includes(task) || false}
                onChange={(e) => {
                  const current = formData.selectedTasks || [];
                  const updated = e.target.checked 
                    ? [...current, task]
                    : current.filter(t => t !== task);
                  handleInputChange('selectedTasks', updated);
                }}
              />
              {task}
            </label>
          ))}
          
          <label className="wizard-mt">Experimental Condition Marker *</label>
          <input 
            type="text"
            placeholder="e.g., control, treatment, high_stress, low_stress"
            value={formData.conditionMarker || ''}
            onChange={(e) => handleInputChange('conditionMarker', e.target.value)}
            className="wizard-input-full wizard-mb-sm"
          />
          <small className="wizard-help-text-mb">
            This condition marker will be used to identify the experimental condition for this task. It will be passed to the setCondition function during experiment execution.
          </small>

          <div className="wizard-highlight-box">
            <p><strong>Examples of condition markers:</strong></p>
            <ul className="wizard-list-small">
              <li><code className="wizard-code">control</code> - for control group participants</li>
              <li><code className="wizard-code">treatment_A</code> - for first treatment condition</li>
              <li><code className="wizard-code">high_cognitive_load</code> - for high difficulty tasks</li>
              <li><code className="wizard-code">visual_stimuli</code> - for visual presentation conditions</li>
            </ul>
          </div>

          <label className="checkbox-label wizard-mt">
            <input 
              type="checkbox" 
              checked={formData.allowConditionOverride || false}
              onChange={(e) => handleInputChange('allowConditionOverride', e.target.checked)}
            />
            Allow experimenter to override condition during test execution
          </label>
          <small className="wizard-help-text-mt">
            When checked, experimenters can manually change the condition marker before starting this task.
          </small>
        </div>
      );

    case 'sensors':
      const sensorTypes = ['Heart Rate (HR)', 'Electroencephalography (EEG)', 'Electrodermal Activity (EDA)', 'Respiration', 'Eye Tracking'];
      return (
        <div className="form-group">
          <label>Select Sensors</label>
          {sensorTypes.map(sensor => (
            <label key={sensor} className="checkbox-label">
              <input 
                type="checkbox" 
                checked={formData.selectedSensors?.includes(sensor) || false}
                onChange={(e) => {
                  const current = formData.selectedSensors || [];
                  const updated = e.target.checked 
                    ? [...current, sensor]
                    : current.filter(s => s !== sensor);
                  handleInputChange('selectedSensors', updated);
                }}
              />
              {sensor}
            </label>
          ))}
        </div>
      );
    
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
          <label>Configuration Notes</label>
          <textarea 
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Add configuration details for this step..."
            rows={4}
          />
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
  
  const initializedRef = useRef(false);

  // Load configuration from JSON file
  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/experiment-config.json?t=' + Date.now()); // Add cache busting
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

  useEffect(() => {
    if (!initializedRef.current && config && selectedProcedures.length === 0) {
      setSelectedProcedures([createInitialConsentProcedure(config)]);
      initializedRef.current = true;
    }
  }, [config, selectedProcedures.length]);

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
    setCurrentWizardProcedure(procedure);
  };

  const handleWizardSave = (configuration) => {
    setSelectedProcedures(prev =>
      prev.map(p => {
        if (p.instanceId === currentWizardProcedure.instanceId) {
          // Extract duration from configuration if present
          const customDuration = configuration.duration?.duration 
            ? parseInt(configuration.duration.duration) 
            : p.customDuration || p.duration;
          
          return { 
            ...p, 
            configuration,
            customDuration,  // Update customDuration
            wizardData: {
              ...p.wizardData,
              rawConfiguration: configuration
            }
          };
        }
        return p;
      })
    );
  };

  const handleRefreshConfig = () => {
    loadConfig();
  };

  if (loading) {
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
          onRefreshConfig={handleRefreshConfig}
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
    </div>
  );
}

export default ExperimentBuilder;