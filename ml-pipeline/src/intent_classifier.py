"""
Intent Classifier for ReAct Agent

This module implements an intent classification system using BERT/DistilBERT
to classify user queries into actionable intents and extract entities.

Intent Categories:
- scheme_search: User looking for schemes matching criteria
- eligibility_check: User wants to know if they qualify for a scheme
- application_info: User needs application process details
- deadline_query: User asking about scheme deadlines
- profile_update: User wants to modify their profile
- general_question: General inquiry about schemes or platform
- nudge_preferences: User configuring notification settings

Entity Types:
- location: Geographic location (state, district)
- income: Income-related information
- occupation: Job or occupation type
- age: Age-related information
- scheme_name: Name of a specific scheme
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import torch
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ort = None
    ONNX_AVAILABLE = False
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline
)
import numpy as np
import re
import os


class Intent(str, Enum):
    """Intent categories for user queries"""
    SCHEME_SEARCH = 'scheme_search'
    ELIGIBILITY_CHECK = 'eligibility_check'
    APPLICATION_INFO = 'application_info'
    DEADLINE_QUERY = 'deadline_query'
    PROFILE_UPDATE = 'profile_update'
    GENERAL_QUESTION = 'general_question'
    NUDGE_PREFERENCES = 'nudge_preferences'


@dataclass
class Entity:
    """Extracted entity from user query"""
    type: str  # location, income, occupation, age, scheme_name
    value: str
    confidence: float


@dataclass
class IntentResult:
    """Result of intent classification"""
    primary_intent: Intent
    secondary_intents: List[Intent]
    confidence: float
    entities: List[Entity]


class IntentClassifier:
    """
    Intent classifier using ONNX-optimized BERT/DistilBERT for query 
    classification and entity extraction.
    """
    
    def __init__(
        self,
        model_name: str = "distilbert-base-uncased",
        model_path: Optional[str] = None,
        use_onnx: bool = True
    ):
        """
        Initialize the intent classifier.
        
        Args:
            model_name: Base model to use (default: distilbert-base-uncased)
            model_path: Path to fine-tuned model (if available)
            use_onnx: Whether to use ONNX for inference
        """
        self.model_name = model_name
        self.model_path = model_path
        self.use_onnx = use_onnx and ONNX_AVAILABLE
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Intent labels
        self.intent_labels = [intent.value for intent in Intent]
        self.num_labels = len(self.intent_labels)
        
        # Load tokenizer
        tokenizer_path = model_path if model_path else model_name
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
        
        if self.use_onnx:
            self._init_onnx(model_path, model_name)
        else:
            self._init_torch(model_path, model_name)
        
        # Entity extraction patterns
        self._init_entity_patterns()
        self._init_intent_patterns()

    # ── Rule-based intent patterns ────────────────────────────────────────────

    def _init_intent_patterns(self):
        """Initialise high-precision regex patterns for intent classification."""
        self.intent_patterns: Dict[str, List[re.Pattern]] = {
            Intent.ELIGIBILITY_CHECK.value: [
                re.compile(r"\bam\s+i\s+eligible\b", re.I),
                re.compile(r"\bdo\s+i\s+qualify\b", re.I),
                re.compile(r"\bcan\s+i\s+(get|apply|avail)\b", re.I),
                re.compile(r"\b(eligib|qualify|qualification)\w*\b", re.I),
                re.compile(r"\bi\s+(am|'m)\s+(a\s+)?(farmer|student|widow|disabled|sc|st|obc)\b", re.I),
            ],
            Intent.APPLICATION_INFO.value: [
                re.compile(r"\bhow\s+to\s+apply\b", re.I),
                re.compile(r"\bapplicat\w+\s+(process|link|url|form|steps?)\b", re.I),
                re.compile(r"\bwhere\s+(do\s+i|can\s+i)\s+apply\b", re.I),
                re.compile(r"\bapply\s+for\s+\w+\s+(scheme|yojana|programme)\b", re.I),
                re.compile(r"\b(documents?|required|needed|submit)\b.*\b(scheme|apply)\b", re.I),
            ],
            Intent.DEADLINE_QUERY.value: [
                re.compile(r"\b(deadline|last\s+date|closing\s+date|expir\w+)\b", re.I),
                re.compile(r"\bwhen\s+(is|does|will)\b.*(clos\w+|end|expir\w+|deadline)\b", re.I),
                re.compile(r"\bapply\s+by\b", re.I),
                re.compile(r"\blast\s+day\s+to\s+apply\b", re.I),
            ],
            Intent.PROFILE_UPDATE.value: [
                re.compile(r"\b(update|change|edit|modify)\s+(my\s+)?(profile|details|information)\b", re.I),
                re.compile(r"\bmy\s+(age|income|state|education|occupation)\s+is\b", re.I),
                re.compile(r"\bi\s+(am|'m)\s+\d+\s+(years?\s+old)?\b", re.I),
                re.compile(r"\bi\s+(live|am\s+from|belong\s+to)\s+\w+\b", re.I),
            ],
            Intent.SCHEME_SEARCH.value: [
                re.compile(r"\b(show|find|search|list|give me)\s+(me\s+)?(all\s+)?(schemes?|yojanas?|programmes?)\b", re.I),
                re.compile(r"\bschemes?\s+for\b", re.I),
                re.compile(r"\bwhat\s+schemes?\b", re.I),
                re.compile(r"\bgovernment\s+(help|support|benefit|scheme)\b", re.I),
                re.compile(r"\b(benefit|subsidy|grant|loan)\s+(for|scheme)\b", re.I),
            ],
            Intent.NUDGE_PREFERENCES.value: [
                re.compile(r"\b(notif\w+|alert|remind\w+)\s*(setting|prefer|me|off|on)\b", re.I),
                re.compile(r"\b(disable|enable|turn\s+(on|off))\s*(notif\w+|alert)\b", re.I),
            ],
            Intent.GENERAL_QUESTION.value: [
                re.compile(r"\bwhat\s+is\b", re.I),
                re.compile(r"\btell\s+me\s+about\b", re.I),
                re.compile(r"\bexplain\b", re.I),
                re.compile(r"\b(info|information)\s+about\b", re.I),
            ],
        }

    def _classify_by_rules(self, query: str) -> Optional[Tuple[Intent, float]]:
        """
        Fast rule-based classification layer.

        Returns (Intent, confidence) if a high-confidence pattern matches, else None.
        Lower-priority intents (GENERAL_QUESTION) are only returned if no other
        intent matched, and with lower confidence so the ML layer can override.
        """
        matches: Dict[str, int] = {}
        general_matches = 0

        for intent_val, patterns in self.intent_patterns.items():
            count = sum(1 for p in patterns if p.search(query))
            if intent_val == Intent.GENERAL_QUESTION.value:
                general_matches = count
            elif count > 0:
                matches[intent_val] = count

        if matches:
            best = max(matches, key=lambda k: matches[k])
            confidence = min(0.70 + matches[best] * 0.10, 0.95)
            return Intent(best), confidence

        if general_matches > 0:
            return Intent.GENERAL_QUESTION, 0.55

        return None

    def _init_torch(self, model_path, model_name):
        """Initialize standard PyTorch model."""
        if model_path:
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_path
            ).to(self.device).eval()
        else:
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                num_labels=self.num_labels
            ).to(self.device).eval()

    def _init_onnx(self, model_path, model_name):
        """Initialize ONNX runtime session."""
        onnx_path = os.path.join(model_path, "model.onnx") if model_path else "model.onnx"
        
        # If ONNX file doesn't exist, we'd normally export it here.
        # For this implementation, we assume it's pre-converted or we'd trigger a conversion.
        if not os.path.exists(onnx_path):
            self._export_to_onnx(onnx_path)
            
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if torch.cuda.is_available() else ['CPUExecutionProvider']
        self.onnx_session = ort.InferenceSession(onnx_path, providers=providers)

    def _export_to_onnx(self, onnx_path):
        """Export the current model to ONNX format."""
        print(f"Exporting model to ONNX: {onnx_path}")
        self._init_torch(self.model_path, self.model_name)
        
        dummy_input = self.tokenizer("dummy text", return_tensors="pt").to(self.device)
        
        torch.onnx.export(
            self.model,
            (dummy_input["input_ids"], dummy_input["attention_mask"]),
            onnx_path,
            input_names=['input_ids', 'attention_mask'],
            output_names=['logits'],
            dynamic_axes={'input_ids': {0: 'batch_size', 1: 'sequence_length'},
                         'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
                         'logits': {0: 'batch_size'}},
            opset_version=12
        )

    def classify(
        self,
        query: str,
        context: Optional[Dict] = None
    ) -> IntentResult:
        """
        Classify user query into intent and extract entities.

        Uses a hybrid approach:
        1. High-precision rule-based patterns (fast, no model load needed).
        2. ML model (ONNX or PyTorch) for queries that rules don't confidently cover.
        """
        # --- Layer 1: rule-based ---
        rule_result = self._classify_by_rules(query)
        entities = self.extract_entities(query)

        # Tokenize input
        inputs = self.tokenizer(
            query,
            return_tensors="np" if self.use_onnx else "pt",
            truncation=True,
            max_length=512,
            padding=True
        )

        if self.use_onnx:
            # ONNX Inference
            onnx_inputs = {
                "input_ids": inputs["input_ids"],
                "attention_mask": inputs["attention_mask"]
            }
            logits = self.onnx_session.run(None, onnx_inputs)[0]
            probabilities = self._softmax(logits[0])
        else:
            # PyTorch Inference
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probabilities = torch.softmax(logits, dim=-1)[0].cpu().numpy()

        # Get primary intent from ML model
        primary_idx = np.argmax(probabilities)
        ml_intent = Intent(self.intent_labels[primary_idx])
        ml_confidence = float(probabilities[primary_idx])

        # --- Layer 2: merge rule + ML ---
        if rule_result is not None:
            rule_intent, rule_confidence = rule_result
            # Use rule result when it's confident OR when it outscores the ML model
            if rule_confidence >= 0.75 or rule_confidence > ml_confidence:
                primary_intent = rule_intent
                confidence = rule_confidence
            else:
                primary_intent = ml_intent
                confidence = ml_confidence
        else:
            primary_intent = ml_intent
            confidence = ml_confidence

        # Get secondary intents (confidence > 0.2)
        secondary_intents = []
        for idx, prob in enumerate(probabilities):
            if idx != primary_idx and prob > 0.2:
                secondary_intents.append(Intent(self.intent_labels[idx]))

        return IntentResult(
            primary_intent=primary_intent,
            secondary_intents=secondary_intents,
            confidence=confidence,
            entities=entities
        )

    def _softmax(self, x):
        """Compute softmax values for each sets of scores in x."""
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()
    
    def _init_entity_patterns(self):
        """Initialize regex patterns for entity extraction"""
        # Indian states
        self.states = [
            'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar',
            'chhattisgarh', 'goa', 'gujarat', 'haryana', 'himachal pradesh',
            'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra',
            'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab',
            'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
            'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi'
        ]
        
        # Income patterns
        self.income_pattern = re.compile(
            r'(?:income|earn|salary|revenue).*?(?:rs\.?|₹|rupees?)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakh|lakhs|thousand|k|cr|crore)?',
            re.IGNORECASE
        )
        
        # Age patterns
        self.age_pattern = re.compile(
            r'(?:age|aged|years old|year old)\s*(?:of|is)?\s*(\d+)',
            re.IGNORECASE
        )
        
        # Occupation keywords
        self.occupations = [
            'farmer', 'teacher', 'doctor', 'engineer', 'student', 'unemployed',
            'self-employed', 'business', 'worker', 'laborer', 'artisan',
            'craftsman', 'fisherman', 'weaver', 'driver', 'shopkeeper'
        ]
    
    def classify(
        self,
        query: str,
        context: Optional[Dict] = None
    ) -> IntentResult:
        """
        Classify user query into intent and extract entities.

        Uses a hybrid approach:
        1. High-precision rule-based patterns (fast).
        2. PyTorch ML model for queries the rules don't confidently cover.
        """
        # --- Layer 1: rule-based ---
        rule_result = self._classify_by_rules(query)
        entities = self.extract_entities(query)

        # Tokenize input
        inputs = self.tokenizer(
            query,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        ).to(self.device)

        # Get predictions
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=-1)[0]

        # Get primary intent from ML model
        primary_idx = torch.argmax(probabilities).item()
        ml_intent = Intent(self.intent_labels[primary_idx])
        ml_confidence = probabilities[primary_idx].item()

        # --- Layer 2: merge rule + ML ---
        if rule_result is not None:
            rule_intent, rule_confidence = rule_result
            if rule_confidence >= 0.75 or rule_confidence > ml_confidence:
                primary_intent = rule_intent
                confidence = rule_confidence
            else:
                primary_intent = ml_intent
                confidence = ml_confidence
        else:
            primary_intent = ml_intent
            confidence = ml_confidence

        # Get secondary intents (confidence > 0.2)
        secondary_intents = []
        for idx, prob in enumerate(probabilities):
            if idx != primary_idx and prob.item() > 0.2:
                secondary_intents.append(Intent(self.intent_labels[idx]))

        return IntentResult(
            primary_intent=primary_intent,
            secondary_intents=secondary_intents,
            confidence=confidence,
            entities=entities
        )
    
    def extract_entities(self, query: str) -> List[Entity]:
        """
        Extract entities from user query.
        
        Args:
            query: User query text
            
        Returns:
            List of extracted entities
        """
        entities = []
        query_lower = query.lower()
        
        # Extract location (states)
        for state in self.states:
            if state in query_lower:
                entities.append(Entity(
                    type='location',
                    value=state.title(),
                    confidence=0.9
                ))
                break
        
        # Extract income
        income_match = self.income_pattern.search(query)
        if income_match:
            income_value = income_match.group(1)
            entities.append(Entity(
                type='income',
                value=income_value,
                confidence=0.85
            ))
        
        # Extract age
        age_match = self.age_pattern.search(query)
        if age_match:
            age_value = age_match.group(1)
            entities.append(Entity(
                type='age',
                value=age_value,
                confidence=0.9
            ))
        
        # Extract occupation
        for occupation in self.occupations:
            if occupation in query_lower:
                entities.append(Entity(
                    type='occupation',
                    value=occupation.title(),
                    confidence=0.85
                ))
                break
        
        # Extract scheme name (simple heuristic - capitalized phrases)
        scheme_pattern = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Scheme|Yojana|Programme|Program))\b')
        scheme_matches = scheme_pattern.findall(query)
        for scheme_name in scheme_matches:
            entities.append(Entity(
                type='scheme_name',
                value=scheme_name,
                confidence=0.8
            ))
        
        return entities
    
    def train(
        self,
        training_data: List[Tuple[str, str]],
        validation_data: Optional[List[Tuple[str, str]]] = None,
        epochs: int = 3,
        batch_size: int = 16,
        learning_rate: float = 2e-5
    ) -> Dict[str, float]:
        """
        Fine-tune the model on labeled training data.
        
        Args:
            training_data: List of (query, intent_label) tuples
            validation_data: Optional validation data
            epochs: Number of training epochs
            batch_size: Training batch size
            learning_rate: Learning rate for optimizer
            
        Returns:
            Dictionary with training metrics
        """
        from torch.utils.data import Dataset, DataLoader
        from torch.optim import AdamW
        from tqdm import tqdm
        
        class IntentDataset(Dataset):
            def __init__(self, data, tokenizer, intent_labels):
                self.data = data
                self.tokenizer = tokenizer
                self.label_to_idx = {label: idx for idx, label in enumerate(intent_labels)}
            
            def __len__(self):
                return len(self.data)
            
            def __getitem__(self, idx):
                query, label = self.data[idx]
                encoding = self.tokenizer(
                    query,
                    truncation=True,
                    max_length=512,
                    padding='max_length',
                    return_tensors='pt'
                )
                return {
                    'input_ids': encoding['input_ids'].squeeze(),
                    'attention_mask': encoding['attention_mask'].squeeze(),
                    'labels': torch.tensor(self.label_to_idx[label])
                }
        
        # Create datasets
        train_dataset = IntentDataset(training_data, self.tokenizer, self.intent_labels)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        
        # Setup training
        self.model.train()
        optimizer = AdamW(self.model.parameters(), lr=learning_rate)
        
        # Training loop
        total_loss = 0
        for epoch in range(epochs):
            epoch_loss = 0
            for batch in tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}"):
                optimizer.zero_grad()
                
                input_ids = batch['input_ids'].to(self.device)
                attention_mask = batch['attention_mask'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                outputs = self.model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels
                )
                
                loss = outputs.loss
                loss.backward()
                optimizer.step()
                
                epoch_loss += loss.item()
            
            avg_epoch_loss = epoch_loss / len(train_loader)
            total_loss += avg_epoch_loss
            print(f"Epoch {epoch+1} - Loss: {avg_epoch_loss:.4f}")
        
        self.model.eval()
        
        # Evaluate if validation data provided
        metrics = {'train_loss': total_loss / epochs}
        if validation_data:
            val_metrics = self.evaluate(validation_data)
            metrics.update(val_metrics)
        
        return metrics
    
    def evaluate(
        self,
        test_data: List[Tuple[str, str]]
    ) -> Dict[str, float]:
        """
        Evaluate model on test data.
        
        Args:
            test_data: List of (query, intent_label) tuples
            
        Returns:
            Dictionary with evaluation metrics (accuracy, precision, recall, f1)
        """
        from sklearn.metrics import accuracy_score, precision_recall_fscore_support
        
        predictions = []
        true_labels = []
        
        for query, true_label in test_data:
            result = self.classify(query)
            predictions.append(result.primary_intent.value)
            true_labels.append(true_label)
        
        # Calculate metrics
        accuracy = accuracy_score(true_labels, predictions)
        precision, recall, f1, _ = precision_recall_fscore_support(
            true_labels,
            predictions,
            average='weighted',
            zero_division=0
        )
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1
        }
    
    def save(self, path: str):
        """Save model and tokenizer to disk"""
        self.model.save_pretrained(path)
        self.tokenizer.save_pretrained(path)
    
    def load(self, path: str):
        """Load model and tokenizer from disk"""
        self.tokenizer = AutoTokenizer.from_pretrained(path)
        self.model = AutoModelForSequenceClassification.from_pretrained(path).to(self.device)
        self.model.eval()
