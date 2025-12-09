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
Install Lab Streaming Layer:
```
   brew install labstreaminglayer/tap/lsl
```
Export the LSL library path to your zshrc (or bash) profile:
```
   echo 'export DYLD_LIBRARY_PATH=/opt/homebrew/lib:$DYLD_LIBRARY_PATH' >> ~/.zshrc
   source ~/.zshrc
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

### Database 

See DatabaseSetup.md

### Frontend Setup

In a second terminal, run:
   cd frontend
   npm install
   npm start

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

