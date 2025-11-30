import json
import re

class TestManager:
    def __init__(self) -> None:
        print("Test Manager initialized...")
        try:
            with open('static/test_files/SER_questions.json') as f:
                self._ser_questions = json.load(f)
                print("SER_questions.json loaded successfully")

        except FileNotFoundError:
            self._ser_questions = {}
            print("SER baseline file, SER_questions.json not found")

        try:
            with open('static/test_files/task_0_data.json') as f: # Task 0 is stressor practice test
                self._task_0_questions = json.load(f)
                print("Stressor task file, task_0_data.json loaded successfully")
        except FileNotFoundError:
            self._task_0_questions = {}
            print("task_0_data.json not found")

        try:
            with open('static/test_files/task_1_data.json') as f:
                self._task_1_questions = json.load(f)
                print("Stressor task file, task_1_data.json loaded successfully")

        except FileNotFoundError:
            self._task_1_questions = {}
            print("task_1_data.json not found")

        try:
            with open('static/test_files/task_2_data.json') as f:
                self._task_2_questions = json.load(f)
                print("Stressor task 2 file, task_2_data.json loaded successfully")

        except FileNotFoundError:
            self._task_2_questions = {}
            print("task_2_data.json not found")

        self._current_question_index = 0  
        self._current_test_index = 0
        self._current_ser_question_index = 0
        self._current_answer = None
        self._current_ser_question_set = 'ser_1'
    
    @property
    def current_ser_question_set(self):
        return self._current_ser_question_set

    @current_ser_question_set.setter
    def current_ser_question_set(self, question_set):
        self._current_ser_question_set = question_set

    @property
    def current_answer(self):
        return self._current_answer
    
    @current_answer.setter
    def current_answer(self, answer):
        self._current_answer = answer
        
    @property
    def ser_questions(self):
        return self._ser_questions
    
    @ser_questions.setter
    def ser_questions(self, ser_questions):
        self._ser_questions = ser_questions

    @property
    def task_0_questions(self):
        return self._task_0_questions
    
    @task_0_questions.setter
    def task_0_questions(self, task_0_questions):
        self._task_0_questions = task_0_questions

    @property
    def task_1_questions(self):
        return self._task_1_questions
    
    @task_1_questions.setter
    def task_1_questions(self, task_1_questions):
        self._task_1_questions = task_1_questions

    @property
    def task_2_questions(self):
        return self._task_2_questions
    
    @task_2_questions.setter
    def task_2_questions(self, task_2_questions):
        self._task_2_questions = task_2_questions
    
    @property
    def current_question_index(self):
        return self._current_question_index
    
    @current_question_index.setter
    def current_question_index(self, index):
        self._current_question_index = index
    
    @property
    def current_test_index(self):
        return self._current_test_index
    
    @current_test_index.setter
    def current_test_index(self, index):
        self._current_test_index = index
    
    @property
    def current_ser_question_index(self):
        return self._current_ser_question_index
    
    @current_ser_question_index.setter
    def current_ser_question_index(self, index):
        self._current_ser_question_index = index
    
    def get_task_questions(self, index):
        task_questions = [self.task_0_questions, self.task_1_questions, self.task_2_questions]

        if index >= len(task_questions):
            return None
        
        return task_questions[index]
    
    def get_ser_question(self, index):      
        if index >= len(self.ser_questions):
            return None
        
        return self.ser_questions[index]

    def get_next_question(self, task_number, index):
        if task_number == 1:
            return self.task_1_questions[index]
        elif task_number == 2:
            return self.task_2_questions[index]
        elif task_number == 0:
            return self.task_0_questions[index]
        else:
            return "Tests completed"
        
    def get_next_test(self, test_index):
        if test_index >= len(self.questions):
            return "Tests completed"
        return self.questions[test_index]

    def preprocess_text(self, text):
        text = text.lower()
        text = re.sub(r'[^\w\s-]', '', text)  
        print(f"Preprocessed text: {text.strip()}")
        return text.strip()

    def check_answer(self, transcription, correct_answers):
        print(f"Transcription: {transcription}")
        transcription = self.preprocess_text(transcription)
        transcription_normalized = transcription.replace('-', '')

        print(f"Checking against answers: {correct_answers}")
        print(f"Processed transcription: '{transcription}', Normalized: '{transcription_normalized}'")

        # Direct match check
        if transcription in correct_answers or transcription_normalized in correct_answers:
            print("Match found!")
            return True

        print("No match found.")
        return False

    def reset_ser_baseline(self, question_set='ser_1'):
        """Reset SER baseline to start from beginning with specified question set"""
        self.current_ser_question_index = 0
        self.current_ser_question_set = question_set

    def get_ser_question_by_set(self, question_set, index):
        """Get SER question from specific question set"""
        if 'questions' not in self.ser_questions:
            return None
        
        question_sets = self.ser_questions['questions']
        if question_set not in question_sets:
            return None
        
        questions = question_sets[question_set]
        if index >= len(questions):
            return None
        
        return questions[index]

    def get_ser_question_count(self, question_set):
        """Get total number of questions in a question set"""
        if 'questions' not in self.ser_questions:
            return 0
        
        question_sets = self.ser_questions['questions']
        if question_set not in question_sets:
            return 0
        
        return len(question_sets[question_set])
    
    def get_available_mat_sets(self):
        """Get information about available MAT question sets"""
        return {
            'mat_practice': {
                'name': 'Practice Test (Subtract 5 from 20)',
                'available': bool(self.task_0_questions),
                'question_count': len(self.task_0_questions) if self.task_0_questions else 0
            },
            'mat_1': {
                'name': 'Test 1 (Subtract 13 from 1,009)',
                'available': bool(self.task_1_questions),
                'question_count': len(self.task_1_questions) if self.task_1_questions else 0
            },
            'mat_2': {
                'name': 'Test 2 (Subtract 17 from 1,059)',
                'available': bool(self.task_2_questions),
                'question_count': len(self.task_2_questions) if self.task_2_questions else 0
            }
        }

    def get_mat_set_by_id(self, set_id):
        """Get MAT question set by ID"""
        set_mapping = {
            'mat_practice': 0,
            'mat_1': 1,
            'mat_2': 2
        }
        
        test_number = set_mapping.get(set_id)
        if test_number is None:
            return None
        
        return self.get_task_questions(test_number)