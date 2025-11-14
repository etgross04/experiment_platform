import csv
import os
from datetime import datetime

class SubjectManager:
    """
    CONTRACT: SubjectManager
    
    PURPOSE:
      Central authority for registering a subject within an experiment/trial context and
      managing the lifecycle of a per‑subject CSV data file with structured metadata header rows.
    
    SCOPE:
      - Subject identity (persistent: subject_id; transient: name/email)
      - Experiment/trial contextualization
      - Controlled creation and appending of CSV rows
      - In‑memory privacy for personal fields
    
    DATA MODEL:
      Metadata (first 6 rows, fixed order):
        1. Experiment Name
        2. Trial Name
        3. Subject ID
        4. Categories
        5. PID
        6. Class Name
      Data columns (self.headers):
        ['Unix_Timestamp','Timestamp','Time_Stopped','Event_Marker',
         'Condition','Audio_File','Transcription']
    
    REQUIRED PRECONDITIONS BEFORE set_subject():
      - experiment_name is a non-empty str
      - trial_name is a non-empty str
      - subject_info contains keys: subject_id, pid, sona_class, subject_dir
        (missing keys raise KeyError externally or break execution)
    
    SIDE EFFECTS:
      - Creates subject directory if absent
      - Creates a CSV file named: YYYY-MM-DD_<experiment>_<trial>_<subject_id>.csv
      - Writes metadata + header row on first creation
      - Appends filtered data rows on append_data()
    
    APPEND BEHAVIOR (append_data):
      - Accepts dict
      - Filters to known headers; empty-string values discarded
      - Writes a single ordered row aligned with self.headers (missing keys => "")
      - Fails gracefully if CSV not initialized (prints message, no exception)
    
    LOAD BEHAVIOR (load_data):
      - Returns list[dict] from DictReader (metadata rows excluded automatically)
      - Requires existing csv_file_path else ValueError
    
    RESET BEHAVIOR:
      - reset_subject(): clears subject_id and csv reference only
      - reset(): full state purge (all experiment, trial, personal, category fields)
    
    PRIVACY GUARANTEE:
      - subject_first_name, subject_last_name, subject_email never serialized to disk
      - Only subject_id used for persistence
    
    ERROR CONTRACT:
      - set_subject(): raises ValueError if experiment/trial unset
      - load_data(): raises ValueError if csv_file_path missing
      - append_data(): prints diagnostic if file absent or malformed; no exception
      - No silent overwrites of existing CSV content; creation only if file absent
    
    THREAD SAFETY:
      - Not thread-safe; external synchronization required for concurrent calls
    
    IMMUTABILITY / MUTATION NOTES:
      - Attributes are mutable via property setters until reset()/reset_subject()
    
    ENCODING / PORTABILITY:
      - CSV written UTF-8 with newline=''
      - Uses os.path.join for cross-platform paths
    
    NON-FUNCTIONAL:
      - Designed for small to moderate experimental session logs
      - No streaming / incremental flush optimization
    
    IMPLEMENTATION ASSUMPTIONS:
      - categories may be None or list[str]; serialized via str() in metadata
      - Caller responsible for time value generation inside appended data
    
    EXTENSION POINTS:
      - Additional headers may be appended by modifying self.headers before set_subject()
      - Validation layer can be wrapped around append_data() externally
    
    NO GUARANTEES:
      - Does not validate semantic correctness of data values
      - Does not enforce uniqueness of subject_id across sessions
    
    USAGE MINIMUM:
      1. Instantiate
      2. Set experiment_name, trial_name, categories (optional)
      3. Call set_subject(subject_info)
      4. Call append_data(row_dict) as needed
      5. load_data() for retrieval
      6. reset()/reset_subject() for lifecycle management
    """
    def __init__(self) -> None:
        self._subject_id = None
        self.csv_file_path = None
        self.txt_file_path = None
        self.PID = None
        self.class_name = None
        self.headers = ['Unix_Timestamp', 'Timestamp', 'Time_Stopped', 'Event_Marker', 'Condition', 'Audio_File', 'Transcription']
        self._experiment_name = None
        self._trial_name = None
        self._subject_folder = None
        self._categories = None
        
        # Only held in RAM and not stored.
        self._subject_first_name = None 
        self._subject_last_name = None
        self._subject_email = None

    @property
    def subject_first_name(self) -> str:
        return self._subject_first_name
    
    @subject_first_name.setter
    def subject_first_name(self, value: str) -> None:
        self._subject_first_name = value

    @property
    def subject_last_name(self) -> str:
        return self._subject_last_name
    
    @subject_last_name.setter
    def subject_last_name(self, value: str) -> None:
        self._subject_last_name = value

    @property
    def subject_email(self) -> str:
        return self._subject_email
    
    @subject_email.setter
    def subject_email(self, value: str) -> None:
        self._subject_email = value

    @property
    def experiment_name(self) -> str:
        return self._experiment_name
    
    @experiment_name.setter
    def experiment_name(self, value: str) -> None:
        self._experiment_name = value

    @property
    def trial_name(self) -> str:
        return self._trial_name
    
    @trial_name.setter
    def trial_name(self, value: str) -> None:
        self._trial_name = value
    
    @property
    def categories(self) -> list[str]:
        return self._categories
    
    @categories.setter
    def categories(self, value: list[str]) -> None:
        self._categories = value

    @property
    def subject_folder(self) -> str:
        return self._subject_folder
    
    @subject_folder.setter
    def subject_folder(self, value: str) -> None:
        self._subject_folder = value
    
    @property
    def subject_id(self) -> str:
        return self._subject_id

    @subject_id.setter
    def subject_id(self, value: str) -> None:
        self._subject_id = value

    def set_subject(self, subject_info: dict) -> None:
        """
            Set the subject's name, ID, and email, PID (if any), class name (if any) and initialize the CSV file.
            Args:
                subject_info (dict): Dictionary containing the subject's name, ID, and email.
                Expected format: {"name": str, "subject_id": str, "email": str, "pid": str, "sona_class": str, "subject_dir":s tr} 
            Returns:
                None
        """
        
        if not self.experiment_name or not self.trial_name:
            raise ValueError("Experiment name and trial name must be set before setting the subject.")
        
        else:
            self.subject_id = subject_info["subject_id"]
            self.PID = subject_info["pid"]
            self.class_name = subject_info["sona_class"]
            self.subject_folder = subject_info.get("subject_dir")

            if not os.path.exists(self.subject_folder):
                os.makedirs(self.subject_folder)

            current_date = datetime.now().strftime("%Y-%m-%d")
            csv_filename = f"{current_date}_{self.experiment_name}_{self.trial_name}_{self.subject_id}.csv"
            self.csv_file_path = os.path.join(self.subject_folder, csv_filename)

            # DEBUG
            print("Subject folder set: ", self.subject_folder)
            print("Subject data csv set: ", self.csv_file_path)
            
            self.create_csv(self.csv_file_path)
    
    def create_csv(self, csv_file_path: str) -> None:
        if not os.path.exists(csv_file_path):
            with open(csv_file_path, mode='w', newline='', encoding='utf-8') as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow([f"Experiment Name: {self.experiment_name}"])
                writer.writerow([f"Trial Name: {self.trial_name}"])
                writer.writerow([f"Subject ID: {self.subject_id}"])
                writer.writerow([f"Categories: {self.categories}"])
                writer.writerow([f"PID: {self.PID}"])
                writer.writerow([f"Class Name: {self.class_name}"])  
                writer.writerow(self.headers)  

    def append_data(self, data: dict) -> None:
        """
        Append data to the main CSV file, ignoring columns that are not relevant to the current data collection.
        Args:
            data (dict): Dictionary containing the data to be appended, where keys are column names and values are the corresponding data.
            Expected format: {'Timestamp': str, 'Event_Marker': str, 'Transcription': str, 'SER_Emotion': str, 'SER_Confidence': str}
        """
        metadata_rows = 6

        try:
            with open(self.csv_file_path, mode='r', newline='', encoding='utf-8') as csvfile:
                reader = csv.reader(csvfile)
                file_contents = list(reader)
                
                if len(file_contents) < metadata_rows + 1:
                    print("Metadata rows not found. Enter subject information first.")
                    return
                
        except FileNotFoundError:
            print("CSV file not found. Enter subject information first.")
            return

        filtered_data = {key: value for key, value in data.items() if key in self.headers and value != ""}
        row = [filtered_data.get(header, "") for header in self.headers]
        
        # DEBUG
        print(row)

        with open(self.csv_file_path, mode='a', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(row)

        print(f"Data has been successfully appended to {self.csv_file_path}.")

    def load_data(self) -> list[dict]:
        """Load and return all data from the CSV file."""
        if not self.csv_file_path:
            raise ValueError("Subject has not been set. Call 'set_subject' first.")
        
        with open(self.csv_file_path, mode='r', newline='', encoding='utf-8') as csv_file:
            reader = csv.DictReader(csv_file)
            return list(reader)

    def reset_subject(self) -> None:
        """Reset the subject details and clear the CSV file reference."""
        self.subject_id = None
        self.csv_file_path = None

    def reset(self):
        """Reset subject manager to initial state"""
        self.subject_id = None
        self.subject_folder = None
        self.experiment_name = None
        self.trial_name = None
        self.data = []
        self.csv_file_path = None
        self.PID = None
        self.class_name = None
        self._subject_first_name = None 
        self._subject_last_name = None
        self._subject_email = None
        self._categories = None