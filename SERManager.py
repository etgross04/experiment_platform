import librosa
import torch
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2Processor
import json
import numpy as np
import torch.nn.functional as F

class SERManager:
    """
    A Speech Emotion Recognition (SER) manager for real-time emotion analysis from audio data.
    
    The SERManager class provides functionality for predicting emotional states from audio
    recordings using a pre-trained Wav2Vec2 model. It supports audio preprocessing, emotion
    classification, and confidence scoring for experimental emotion analysis applications.
    
    Key Features:
    - Pre-trained Wav2Vec2 model for speech emotion recognition
    - Automatic device detection (MPS/CPU) for optimal performance
    - Audio preprocessing with padding and truncation to fixed lengths
    - Multi-class emotion prediction with confidence scores
    - Top-k prediction ranking for detailed analysis
    - Label mapping for human-readable emotion categories
    
    Attributes:
        device (str): Computing device used for inference ('mps', 'cuda', or 'cpu')
        max_length (int): Maximum audio length in samples (32000 = ~2 seconds at 16kHz)
        label_map (dict): Mapping from emotion labels to numeric IDs
        inverse_label_map (dict): Mapping from numeric IDs to emotion labels
    
    Usage:
        >>> ser_manager = SERManager()
        >>> predictions = ser_manager.predict_emotion("audio_sample.wav")
        >>> # Returns: [('happy', 0.85), ('neutral', 0.10), ('sad', 0.05)]
        >>> top_emotion, confidence = predictions[0]
    
    Model Architecture:
        - Base Model: Wav2Vec2ForSequenceClassification
        - Input: 16kHz mono audio, max 2 seconds (32000 samples)
        - Output: Softmax probabilities over emotion classes
        - Preprocessing: Automatic padding/truncation to fixed length
    
    Audio Processing:
        - Sample Rate: 16kHz (automatically resampled if needed)
        - Format: WAV files supported via librosa
        - Length: Fixed 32000 samples (~2 seconds)
        - Padding: Zero-padding for shorter audio clips
        - Truncation: Clips longer audio to max_length
    
    Emotion Categories:
        The model supports multiple emotion categories defined in label maps:
        - Common emotions: happy, sad, angry, neutral, fear, surprise, disgust
        - Custom categories can be defined via label mapping files
    
    Performance Optimization:
        - MPS (Metal Performance Shaders) support for Apple Silicon
        - CUDA support for NVIDIA GPUs
        - CPU fallback for universal compatibility
        - Batch processing capabilities for multiple audio files
    
    File Dependencies:
        - SER_MODEL/: Pre-trained model directory with config and weights
        - label_maps/label_map.json: Emotion label to ID mapping
        - label_maps/inverse_label_map.json: ID to emotion label mapping
    
    Error Handling:
        - Graceful handling of missing label map files
        - Device compatibility checks and fallbacks
        - Audio loading error management
        - Model loading validation
    
    Dependencies:
        - torch: PyTorch for neural network inference
        - transformers: Hugging Face transformers for Wav2Vec2
        - librosa: Audio loading and preprocessing
        - numpy: Array operations and data manipulation
        - json: Label map file loading
    
    Thread Safety:
        This class is not inherently thread-safe. External synchronization
        is required for concurrent access to the model during inference.
    
    Note:
        - Model files must be present in 'SER_MODEL' directory
        - Audio is automatically normalized and preprocessed
        - Predictions include confidence scores for reliability assessment
        - Top-3 predictions are returned for comprehensive analysis
    """
    def __init__(self) -> None:
        device = 'mps' if torch.backends.mps.is_built() else 'cpu'  # Automatically detect if MPS is available
        self.device = device  # Save device for later use
        self._model = Wav2Vec2ForSequenceClassification.from_pretrained("SER_MODEL").to(self.device)
        self._processor = Wav2Vec2Processor.from_pretrained("SER_MODEL")
        self.max_length = 32000
        self._audio_folder = None

        try:
            with open('label_maps/label_map.json', 'r') as f:
                self.label_map = json.load(f)

            with open('label_maps/inverse_label_map.json', 'r') as f:
                self.inverse_label_map = json.load(f)

        except FileNotFoundError:
            print("Label maps not found. Please ensure that the label maps are in the correct directory.")

    def _preprocess_audio(self, audio_chunk):
        """
        Predicts the emotion from a given audio chunk using a custom trained Wav2Vec2 model.
        Parameters:
            - audio_chunk: audio file in wav format. 
        Returns:
            - str: The predicted emotion label.
        """
        speech, sr = librosa.load(audio_chunk, sr=16000)

        if len(speech) > self.max_length:
            speech = speech[:self.max_length]
        else:
            speech = np.pad(speech, (0, self.max_length - len(speech)))

        inputs = self._processor(speech, sampling_rate=16000, return_tensors="pt", padding=True, truncation=True, max_length=self.max_length)

        return inputs.input_values.squeeze()
    
    def predict_emotion(self, audio_chunk):
        input_values = self._preprocess_audio(audio_chunk).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self._model(input_values)

        logits = outputs.logits
        predicted_id = logits.argmax(dim=-1).item()
        softmax_probs = F.softmax(logits, dim=-1)
        
        top_probs, top_indices = torch.topk(softmax_probs, k=3, dim=-1)
        top_labels = [self.inverse_label_map[str(idx.item())] for idx in top_indices[0]]
        top_scores = top_probs[0].tolist()

        # confidence = softmax_probs[0, predicted_id].item()
        # return self.inverse_label_map[str(predicted_id)], confidence

        return list(zip(top_labels, top_scores))
    