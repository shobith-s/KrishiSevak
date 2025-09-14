# backend/classifier.py

import torch
from torchvision import models, transforms
from PIL import Image
import json
import logging

logger = logging.getLogger(__name__)

# --- 1. LOAD THE PRE-TRAINED MODEL ---
# We are using MobileNetV2, a model known for being fast and accurate.
# It has been pre-trained on the ImageNet dataset, a huge library of general images.
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
model.eval() # Set the model to evaluation mode (important for getting predictions)

# --- 2. LOAD THE CLASS LABELS ---
# The ImageNet dataset has 1000 classes. We need to know what they are.
# You will need to download this file:
# https://raw.githubusercontent.com/pytorch/hub/master/imagenet_class_index.json
# and place it in your `backend` folder.
try:
    with open("imagenet_class_index.json", "r") as f:
        class_idx = json.load(f)
        # We only need the class names, not the extra index
        imagenet_classes = [class_idx[str(k)][1] for k in range(len(class_idx))]
except FileNotFoundError:
    logger.error("imagenet_class_index.json not found. Please download it and place it in the backend folder.")
    imagenet_classes = []


# --- 3. DEFINE IMAGE TRANSFORMATIONS ---
# Images need to be in a specific format (size, color normalization, etc.)
# before they can be processed by the model.
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# --- 4. THE CLASSIFICATION FUNCTION ---
def classify_real_image(image_path: str) -> dict:
    """
    Opens an image, preprocesses it, and uses the MobileNetV2 model to predict its content.
    """
    try:
        # Open the uploaded image
        img = Image.open(image_path).convert('RGB')
        
        # Apply the transformations
        input_tensor = preprocess(img)
        input_batch = input_tensor.unsqueeze(0) # Create a mini-batch as expected by the model

        # Use the model to make a prediction
        with torch.no_grad():
            output = model(input_batch)
        
        # The output gives us scores for all 1000 classes. We want the one with the highest score.
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        
        # Get the top prediction
        confidence, predicted_idx = torch.max(probabilities, 0)
        
        # Map the prediction index to the actual class name
        predicted_class_name = imagenet_classes[predicted_idx.item()]
        
        logger.info(f"Real classifier result: {predicted_class_name} with confidence {confidence.item():.2f}")
        
        # Return the result in the same format as our old mock function
        # IMPORTANT: We are pretending the detected object is a "disease" for our app's logic.
        return {"disease": predicted_class_name.replace("_", " ").title(), "confidence": confidence.item()}

    except Exception as e:
        logger.error(f"Error during image classification: {e}")
        return {"disease": "Error during analysis", "confidence": 0.0}