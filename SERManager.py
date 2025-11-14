import librosa
import torch
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2Processor
import json
import numpy as np
import torch.nn.functional as F

class SERManager:
    """
    SERManager: Speech Emotion Recognition System

    Contract:
    - Purpose: Predict emotional states from audio recordings using a pre-trained Wav2Vec2 model.
    
    - Capabilities:
        1. Load and preprocess audio files (WAV format, 16kHz).
        2. Predict emotions with confidence scores.
        3. Return top-3 emotion predictions ranked by probability.
        4. Auto-detect optimal compute device (MPS/CUDA/CPU).
    
    - Constraints:
        1. Audio must be in WAV format or compatible with librosa.
        2. Audio is resampled to 16kHz if necessary.
        3. Audio is truncated to 32000 samples (~2 seconds) or zero-padded if shorter.
        4. Requires 'SER_MODEL' directory with model files.
        5. Requires 'label_maps/label_map.json' and 'label_maps/inverse_label_map.json'.
    
    - Inputs:
        - predict_emotion(audio_chunk: str) -> list[tuple[str, float]]
            * audio_chunk: Path to audio file.
            * Returns: List of (emotion_label, confidence_score) tuples, top 3 predictions.
    
    - Outputs:
        1. Emotion labels as strings (e.g., 'happy', 'sad', 'angry', 'neutral').
        2. Confidence scores as floats between 0.0 and 1.0.
        3. Predictions sorted by confidence (highest first).
    
    - Behavior:
        1. Audio preprocessing: Load → Resample to 16kHz → Pad/Truncate to 32000 samples.
        2. Model inference: Process through Wav2Vec2 → Generate logits → Apply softmax.
        3. Return top-3 predictions with confidence scores.
    
    - Error Handling:
        1. Prints warning if label map files are not found.
        2. Falls back to CPU if MPS/CUDA is unavailable.
        3. librosa handles audio loading errors.
    
    - Dependencies:
        1. torch
        2. transformers
        3. librosa
        4. numpy
        5. json
    
    - Thread Safety: Not thread-safe. Use external synchronization for concurrent inference.
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
    