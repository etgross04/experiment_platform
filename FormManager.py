
import json
import os
import re
import csv

class FormManager:
    """
    LLM CONTRACT: FormManager

    PURPOSE:
    Manage survey/form metadata, customize survey URLs with subject identifiers, extract CSV responses, and persist subject and survey data in JSON.

    SCOPE:
    Single-user session management; no concurrency guarantees. File I/O limited to JSON and CSV under surveys/ and subject_data/ directories.

    PRIMARY RESPONSIBILITIES:
    1. Load base surveys (surveys/surveys.json) and dynamically added surveys (surveys/added_surveys.json).
    2. Add surveys idempotently to added_surveys.json.
    3. Retrieve raw or customized survey URLs (placeholder 'Sample+ID' variants replaced with subject_id).
    4. Autofill all loaded survey URLs with a given subject_id.
    5. Extract one row of CSV responses by exact, validated email match.
    6. Maintain subject registry (subject_data/subjects.json) keyed by email.

    DATA CONTRACTS:
    Survey JSON:
    {
        "surveys": [
            {"name": "<str>", "url": "<str>"}
        ]
    }
    Added Surveys JSON:
    {
        "added_surveys": [
            {"name": "<str>", "url": "<str>"}
        ]
    }
    Subjects JSON:
    {
        "subjects": {
            "<email>": {
                "subject_id": "<str>",
                "first_name": "<str>",
                "last_name": "<str>"
            }
        }
    }

    METHOD CONTRACTS:
    add_survey(name:str, url:str) -> str
        Preconditions: name,url non-empty.
        Postconditions: Adds unique survey to added_surveys.json.
        Returns: "Success" | "Survey already exists." | "Survey file missing."

    get_survey_url(name:str) -> str
        Returns first matching survey url or "not found".

    get_custom_url(name:str, subject_id:str) -> str
        Returns customized URL or "Survey with name '<name>' not found."

    autofill_forms(subject_id:str) -> None
        Replaces all 'Sample+ID' case-variants in current self.surveys URLs.

    find_survey_response(input_file:str, output_file:str, email:str) -> bool
        Writes matched row to output_file if email matches validated "Email" column.
        Returns True if found, else False.

    add_to_subject_ids(subject_id, first_name, last_name, email) -> None
        Idempotent add; silently ignores existing email.

    get_subject_name(email:str) -> (first_name:str|None, last_name:str|None)

    UTILITY:
    is_valid_email(email:str) -> bool
    clean_string(value:str) -> str (lowercase, spaces->_, strip, remove non [a-zA-Z0-9_-])

    PLACEHOLDER HANDLING:
    Variations replaced: Sample+ID, SAMPLE+ID, sample+id, Sample+Id, sample+Id, SAMPLE+Id.

    ERROR & EDGE BEHAVIOR:
    - Missing JSON files: auto-create minimal valid structure.
    - Missing "Email" column in CSV: returns False.
    - Empty URL input to customize_form_url: returned unchanged.
    - Duplicate survey add: not re-added.
    - Missing subject email lookup: returns (None, None).

    INVARIANTS:
    - self._surveys always list of dict with keys name,url.
    - Subject file always contains top-level "subjects" after any mutation.
    - Emails treated case-insensitively for matching; stored as provided.

    NON-GUARANTEES:
    - No concurrency safety.
    - No validation of URL formats beyond placeholder replacement.
    - No partial write recovery.

    PERFORMANCE NOTES:
    - Linear search over surveys and CSV rows.
    - File I/O synchronous; suitable for small datasets.

    SECURITY:
    - Assumes trusted file system.
    - No sanitization beyond simple string cleaning.

    EXTENSION POINTS:
    - Add caching layer for surveys.
    - Add thread locks for safe multi-thread access.
    """
    def __init__(self) -> None:
        self._surveys_file = "surveys/surveys.json"
        self._added_surveys_file = "surveys/added_surveys.json"
        self._surveys = self.load_surveys()
        self._formatted_surveys = []
        self._added_surveys = []
        print("Form Manager initialized...")

    @property
    def added_surveys(self) -> list:
        return self._added_surveys
    
    @added_surveys.setter
    def added_surveys(self, added_surveys) -> None:
        self._added_surveys = added_surveys

    @property
    def embed_codes(self) -> list:
        return self._embed_codes
    
    @embed_codes.setter
    def embed_codes(self, embed_codes) -> None:
        self._embed_codes = embed_codes

    @property
    def surveys(self) -> list:
        return self._surveys
    
    @surveys.setter
    def surveys(self, surveys) -> None:
        self._surveys = surveys
    
    @property
    def formatted_surveys(self) -> list:
        return self._formatted_surveys
    
    @formatted_surveys.setter
    def formatted_urls(self, formatted_urls) -> None:
        self._formatted_urls = formatted_urls
    
    @formatted_surveys.deleter
    def formatted_surveys(self) -> None:
        self._formatted_surveys = []

    def add_survey(self, survey_name, survey_url) -> str:
        """
        Adds a survey to the list of surveys.
        Current functionality is a modification of the original function to store survey links in a JSON file.
        If the old functionality is needed, comment out the blocks of code that are marked with a comment and
        uncomment everything else.  
        """
        survey_data = self.load_added_surveys()
        if survey_data is None:
            print("Survey file missing.")
            return("Survey file missing.")

        survey = {
            "name": survey_name,
            "url": survey_url
        }

        if survey not in survey_data:
            survey_data.append(survey)

            if self._added_surveys_file:
                with open(self._added_surveys_file, "w") as file:
                    json.dump({"surveys": survey_data}, file, indent=4)
                return "Success"
            else:
                print("Survey already exists.")
                return "Survey already exists."
    
    def find_survey_response(self, input_file, output_file, search_email) -> bool:
        with open(input_file, mode="r", newline="", encoding="utf-8") as infile:
            reader = csv.reader(infile)
            headers = next(reader)
            
            try:
                email_index = headers.index("Email")
            except ValueError:
                print("Email column not found.")
                return False
            
            matching_row = None
            for row in reader:
                email_value = row[email_index].strip().lower()
                if self.is_valid_email(email_value) and email_value == search_email:
                    matching_row = row
                    break
            
            if matching_row is None:
                print(f"Survey response for {search_email} not found.")
                return False
            else:
                with open(output_file, mode="w", newline="", encoding="utf-8") as outfile:
                    writer = csv.writer(outfile)
                    writer.writerow(headers)
                    writer.writerow(matching_row)
                    print(f"Survey response for {search_email} found. Writing to {output_file}")
                    return True
            
    def is_valid_email(self, email):
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return re.match(pattern, email) is not None

    def survey_exists(self, survey_name) -> bool:
        surveys = self.load_surveys()
        for survey in surveys:
            if survey["name"] == survey_name:
                return True
        return False
    
    def clean_string(self, value) -> str:
        outstring = value.lower().replace(' ', '_').strip()
        outstring = re.sub(r"[^a-zA-Z0-9_\-]", "", outstring)
        return outstring
    
    def get_survey_url(self, name):
        """
        Retrieve the URL of a survey by its name.
        Args:
            name (str): The name of the survey to find.
        Returns:
            str: The URL of the survey if found, otherwise "Survey not found".
        """
        surveys = self.load_surveys()
        survey = next((s for s in surveys if s["name"] == name), None)
        if not survey:
            return "Survey not found"
        else:
            return survey["url"]

    def remove_survey(self, survey_name) -> None:
        for survey in self._surveys:
            if survey["name"] == survey_name:
                self._surveys.remove(survey)

        with open(self._surveys_file, "w") as file:
            json.dump({"surveys": self._surveys}, file, indent=4)

    def customize_form_url(self, url, subject_id) -> str:
        """
        Replaces 'SampleID' placeholder in a Google Forms URL with the provided subject_id.
        Parameters:
        url (str): The Google Forms URL containing 'SampleID' as a placeholder.
        subject_id (str): The value to replace 'SampleID'.
        Returns:
        str: The updated URL with 'SampleID' replaced by subject_id.
        """
        if not url.strip():
            return url
        
        # URL-encode the subject_id to handle special characters (like @ and .)
        from urllib.parse import quote
        encoded_subject_id = quote(subject_id, safe='')
        
        # Replace the placeholder (case-insensitive)
        variations = ["SampleID", "SAMPLEID", "sampleid"]
        
        updated_url = url
        for variation in variations:
            updated_url = updated_url.replace(variation, encoded_subject_id)
        
        return updated_url

    def autofill_forms(self, subject_id) -> None:
        formatted_surveys = []
        if self.surveys:
            for survey in self.surveys:
                url = self.customize_form_url(survey["url"], subject_id)
                formatted_survey = {
                    "name": survey["name"],
                    "url": url
                }
                formatted_surveys.append(formatted_survey)

            self.surveys = formatted_surveys
            del self.formatted_surveys
        else:
            raise ValueError("No surveys to autofill.")
    
    def load_added_surveys(self) -> list:
        if not os.path.exists(self._added_surveys_file):
            print("surveys/added_surveys.json does not exist. Adding new file...")
            with open(self._added_surveys_file, "w") as file:
                json.dump({"added_surveys": []}, file)
    
            with open(self._added_surveys_file, "r") as file:
                added_surveys = json.load(file)
                surveys = added_surveys.get("added_surveys", [])
                return surveys
        else:
            with open(self._added_surveys_file, "r") as file:
                print("Loading added surveys...")
                added_surveys = json.load(file)
                surveys = added_surveys.get("added_surveys", [])
                return surveys
            
    def load_surveys(self) -> list:
        if not os.path.exists(self._surveys_file):
            print("surveys/surveys.json does not exist.")
            return []
        else:
            with open(self._surveys_file, "r") as file:
                survey_data = json.load(file)
                surveys = survey_data.get("surveys", [])
                return surveys
            
    def get_survey_url(self, survey_name: str) -> str:
        surveys = self.load_surveys()
        added_surveys = self.load_added_surveys()
        for survey in surveys + added_surveys:
            if survey["name"] == survey_name:
                return survey["url"]
    
        return "not found"
    
    def get_custom_url(self, survey_name: str, subject_id: str) -> str:
        """
        Retrieves the URL for the given survey and customizes it with the subject's name and ID.

        Parameters:
            survey_name (str): The name of the survey to retrieve the URL for.
            subject_id (str): The ID of the subject to be inserted into the URL.

        Returns:
            str: The customized URL for the specified survey.
        """
        survey_url = self.get_survey_url(survey_name)

        if survey_url is None: 
            return f"Survey with name '{survey_name}' not found."  
        
        return self.customize_form_url(survey_url, subject_id)
    
    def get_subject_name(self, email: str) -> str:
        with open('subject_data/subjects.json', 'r') as file:
            subject_objs = json.load(file)
            for key, value in subject_objs['subjects'].items():
                if key == email: 
                    return value['first_name'], value['last_name']
                
        return None, None
      
    def add_to_subject_ids(self, subject_id, first_name, last_name, email) -> None:
        """
        Add the subject's ID, first name, last name, and email to the subject IDs file.
        Args:
            subject_id (str): The subject's unique ID.
            first_name (str): The subject's first name.
            last_name (str): The subject's last name.
            email (str): The subject's email address.
        """

        file_path = 'subject_data/subjects.json'

        if not os.path.exists(file_path):
            print("subject_data/subjects.json does not exist. Creating new file...")
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as file:
                json.dump({"subjects": {}}, file, indent=4)

            with open(file_path, 'r') as file:
                subject_objs = json.load(file)
        else:
            with open(file_path, 'r') as file:
                subject_objs = json.load(file)

        if "subjects" not in subject_objs:
            subject_objs["subjects"] = {}
            print("Subjects key not found. Creating new key.")

        if email in subject_objs["subjects"]:
            return

        subject_objs["subjects"][email] = {
            "subject_id": subject_id,
            "first_name": first_name,
            "last_name": last_name
        }

        with open(file_path, 'w') as file:
            json.dump(subject_objs, file, indent=4)
            return 