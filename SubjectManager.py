import csv
import os
from datetime import datetime

class SubjectManager:
    def __init__(self) -> None:
        self._subject_id = None
        self.csv_file_path = None
        self.txt_file_path = None
        self.PID = None
        self.class_name = None

        # This csv file is for tracking audio file names and the transcription of the ser baseline.
        self.headers = ['experiment_name', 
                        'trial_name', 
                        'subject_id', 
                        'experimenter_name', 
                        'pid',
                        'class_name',
                        'unix_timestamp', 
                        'timestamp', 
                        'time_stopped',
                        'time_stopped_unix', 
                        'event_marker', 
                        'condition', 
                        'audio_file', 
                        'transcription',
                        'question_set',
                        'question_index'
                        ]
        
        self._experiment_name = None
        self._trial_name = None
        self._subject_folder = None
        self._subject_first_name = None 
        self._subject_last_name = None
        self._subject_email = None
        self._experimenter_name = None
    
    @property
    def experimenter_name(self) -> str:
        return self._experimenter_name
    
    @experimenter_name.setter
    def experimenter_name(self, value: str) -> None:
        self._experimenter_name = value

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
                writer.writerow(self.headers)  

    def append_data(self, data: dict) -> None:
        """
        Append data to the CSV file with metadata in each row.
        
        Args:
            data (dict): Dictionary containing the data to be appended.
                        Metadata columns will be auto-populated.
        """
        data_with_metadata = {
            'experiment_name': self.experiment_name,
            'trial_name': self.trial_name,
            'subject_id': self.subject_id,
            'experimenter_name': self.experimenter_name or 'Unknown',
            'pid': self.PID or '',
            'class_name': self.class_name or '',
            **data  
        }

        filtered_data = {
            key: value for key, value in data_with_metadata.items() 
            if key in self.headers
        }
        
        # Build row in correct header order
        row = [filtered_data.get(header, "") for header in self.headers]
        
        # DEBUG
        print(f"Appending row: {row}")

        with open(self.csv_file_path, mode='a', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(row)

        print(f"Data successfully appended to {self.csv_file_path}")

    def load_data(self) -> list[dict]:
        """Load and return all data from the CSV file."""
        if not self.csv_file_path:
            raise ValueError("Subject has not been set. Call 'set_subject' first.")
        
        import pandas as pd
        df = pd.read_csv(self.csv_file_path)
        return df.to_dict('records')

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
        self._experimenter_name = None