# Cognitive Science Experiment Platform

A full-stack web application for building, configuring, and running cognitive science experiments with integrated biometric data collection, audio recording, and real-time experimenter-subject coordination.

## Overview

This platform provides researchers with a comprehensive toolkit for designing and executing cognitive science experiments. It features a drag-and-drop experiment builder, real-time communication between experimenter and subject interfaces, and seamless integration with various data collection modalities including biometrics, audio recording, and standardized cognitive tasks.

## Architecture

### Backend (Flask/Python)
- RESTful API server with Server-Sent Events (SSE) for real-time updates
- Session management and experiment orchestration
- Audio recording, transcription, and Speech Emotion Recognition (SER)
- Biometric data integration (EmotiBit, Vernier respiratory belt)
- File management and data storage
- Experiment template system with JSON-based configuration

### Frontend (React)
- **Experiment Builder**: Visual interface for creating experiment protocols
- **Experimenter Interface**: Control panel for managing live sessions
- **Subject Interface**: Participant-facing task execution environment

## Key Features

### Experiment Design
- **Drag-and-drop builder** for composing experiment sequences
- **Procedure library** with pre-configured tasks and paradigms
- **Custom procedure creation** including PsychoPy integration
- **Configuration wizards** for each procedure type
- **Template system** for reusable experiment designs

### Data Collection Modalities
- **Audio Recording**: Microphone input with real-time transcription
- **Speech Emotion Recognition**: Automated emotion classification from speech
- **Biometric Sensors**: EmotiBit integration for HR, EDA, EEG
- **Respiratory Monitoring**: Vernier belt integration
- **Survey Integration**: Google Forms with auto-fill capabilities
- **Consent Management**: Links to digital consent forms with signature capture

### Supported Task Types
- Mental Arithmetic Task (MAT)
- Perceived Restorativeness Scale (PRS)
- SER Baseline Recording
- Integrated Google surveys and questionnaires
- Break/rest periods with media
- Creation of event markers for tasks performed in external software (e.g. PsychoPy)
- Demographics collection through external surveys

### Session Management
- Real-time experimenter-subject communication via SSE
- Session-based data organization
- Participant registration and tracking
- Progress monitoring and procedure sequencing
- Audio system testing and configuration

## Technical Stack

**Backend:**
- Flask 
- Flask-CORS
- Threading for concurrent operations
- HDF5 for data storage
- Transcription via Azure Speech Services
- Custom SER model integration

**Frontend:**
- React with Hooks
- CSS Modules
- Server-Sent Events (EventSource API)
- File upload with drag-and-drop

## Installation

### NOTES
- Please note that the SER model is too large for the repo and is hosted elsewhere (links to come). Certain SER related functions will not work unless the SER_MODEL folder and its contents are present in the root folder of the project.
- To use Azure Speech Services, a .env file in the root folder is needed. This should hold login credentials and a valid Azure API key.

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn
- hdf5 and h5py

### Backend Setup
Install Homebrew

Install hdf5:
```
   brew install hdf5
```

Export the hdf5 path for h5py:
```
   export HDF5_DIR=$(brew --prefix hdf5)
```
Install h5py:
```
   pip install --no-cach-dir h5py
```

Install Python dependencies:
```
   pip install -r requirements.txt
```
```
   pip install flask flask-cors werkzeug
```
Run the Flask server:
   python app.py

### Frontend Setup

In a second terminal, run:
   cd frontend
   npm install
   npm start

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## Usage

### Creating an Experiment

1. **Navigate to Experiment Builder** and design your experiment by:
   - Dragging procedures from the library to the canvas
   - Configuring each procedure using the setup wizard
   - Specifying experiment metadata and estimated duration
   - Saving the experiment template

2. **Launch an Experiment Session**:
   - Select an experiment template from the home screen
   - Configure experiment and trial names for data organization
   - The system creates a unique session ID

3. **Experimenter Setup**:
   - Complete pre-test instruction wizard
   - Configure sensors and audio devices
   - Launch subject interface
   - Conduct participant registration and consent

4. **Running the Session**:
   - Guide participants through procedures
   - Monitor progress in real-time
   - Access procedure-specific controls in the tool panel
   - Complete experiment and save all data

### Data Organization

Data is organized hierarchically:

experiments/subject_data/
└── [experiment_name]/
    └── [trial_name]/
        └── [timestamp_subject_id]/
            ├── session.json
            ├── consent_record.json
            ├── audio_files/
            ├── biometric_data.h5
            └── transcription_SER.csv

## Configuration

### Experiment Configuration (experiment-config.json)
Defines available procedures, categories, paradigms, and wizard steps for the experiment builder.

### Instruction Steps (instruction-steps.json)
Contains step-by-step instructions displayed to experimenters for each procedure type.

### Procedure Configuration
Each procedure can be configured with:
- Duration and timing parameters
- Required sensors/metrics
- Task-specific settings (e.g., question sets, stressor types)
- PsychoPy integration settings
- Survey URLs and autofill parameters

## API Endpoints

### Session Management
- POST /api/experiments/<experiment_id>/run - Start new session
- POST /api/sessions/<session_id>/set-experiment-trial - Configure session
- POST /api/sessions/<session_id>/participant - Register participant
- GET /api/sessions/<session_id>/stream - SSE connection for updates

### Audio & Recording
- POST /start_recording - Begin audio capture
- POST /test_audio - Test audio system
- POST /record_task_audio - Task-specific recording
- POST /process_audio_files - Batch transcription/SER

### Data Collection
- POST /start_event_manager - Begin biometric streaming
- POST /import_emotibit_csv - Upload ground truth data
- POST /set_condition - Set experimental condition marker

### Experiment Management
- GET /api/experiments - List all templates
- POST /api/experiments - Save new template
- POST /api/upload-consent-form - Upload consent PDF

## Extending the Platform

### Adding New Procedures

1. Create a React component in frontend/src/procedures/
2. Add procedure definition to experiment-config.json
3. Create instruction steps in instruction-steps.json
4. Register component in SubjectInterface.js
5. Add backend endpoints if needed for specialized data collection

### Custom Task Integration

The platform supports integration with external tools like PsychoPy through transition screens and session coordination.

## Data Privacy & Ethics

- All participant data is stored locally
- Consent forms required before data collection
- Session-based isolation of participant information
- Support for institutional review board (IRB) approved consent documents

## License

[TODO]

## Support

For issues, questions, or contributions, please contact Brian @ brn.cntrll at gmail.

## Citation

If you use this platform in your research, please cite [citation information].