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

## API Endpoints

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