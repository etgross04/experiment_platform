# Usage

## Creating an Experiment

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

## Data Organization
### IMPORTANT
The Analysis Platform and the Experiment Platform are intended to work together and share the same path structures. When using the Analysis Platform, browse and select a specific <trial_name> folder (Experiment_Platform/subject_data/<experiment_name>/<trial_name>/). Do not select <experiment_name>.
If custom analysis combinations are required, create a custom "subect_data" folder on the desktop and place your desired <subject_id> folders in it. Then, browse and select subject_data/. 

Data is organized hierarchically:

Subject data including audio file logs, the event marker file, and the SER data is found in:
experiments/subject_data/<experiment_name>/<trial_name>/<timestamp_subject_id>/

Emotibit Data is stored in:
experiments/subject_data/<experiment_name>/<trial_name>/<timestamp_subject_id>/emotibit_data/

Vernier Data is stored in:
experiments/subject_data/<experiment_name>/<trial_name>/<timestamp_subject_id>/vernier_data/

Polar h10 data is stored in:
experiments/subject_data/<experiment_name>/<trial_name>/<timestamp_subject_id>/cardiac_data/


## Configuration

### Experiment Configuration (experiment-config.json)
Defines available procedures, categories, paradigms, and wizard steps for the experiment builder.

### Instruction Steps (instruction-steps.json)
Contains step-by-step instructions displayed to experimenters for each procedure type.

### Procedure Configuration
Each procedure can be configured with:
- Estimated Duration and timing parameters
- Required sensors/metrics
- Task-specific settings (e.g., question sets, stressor types)
- External software integration settings
- Survey URLs and autofill parameters

## Extending the Platform

### Adding New Procedures

1. Create a React component in frontend/src/procedures/
2. Add procedure definition to experiment-config.json
3. Create instruction steps in instruction-steps.json
4. Register component in SubjectInterface.js
5. Add backend endpoints if needed for specialized data collection

### Adding Managers
If new sensors are added, python modules must be added for managing their streams
1. Create the python module using existing sensor managers as a guide. 
2. Add the necessary imports and initialization to app.py
3. Front end refactoring will be required for interfacing with the new sensor (buttons, alerts, etc.)

### Custom Task Integration

The platform supports integration with external tools like PsychoPy through transition screens and session coordination. Procedures performed in external software can be added to the procedure inventory and their specific platform can be specified.

## Data Privacy & Ethics

- All participant data is stored locally, including data stored in the postgres db.
- Consent forms required before data collection
- Session-based isolation of participant information

## License

TODO

## Support

For issues, questions, or contributions, please contact Brian Cantrell @ brn.cntrll at gmail.

## Citation

If you use this platform in your research, please cite Brian Cantrell, PhD, UCSD Cognitive Science XRLAB.