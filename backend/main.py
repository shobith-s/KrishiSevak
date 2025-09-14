# backend/main.py

from groq import Groq
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import shutil
import os
import logging
from classifier import classify_real_image

# --- Load Environment Variables ---
load_dotenv()

# --- Basic Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- FastAPI App Initialization ---
app = FastAPI(title="Digital Agriculture Officer API")

# --- API KEY VALIDATION ---
api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY not found in .env file. Please create a .env file in the backend folder and add your key.")

# --- Groq Client Initialization ---
client = Groq(api_key=api_key)

MODEL_NAME = "llama-3.3-70b-versatile"

# --- CORS Middleware ---
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    language: str = "English"

# --- API Endpoints ---
@app.get("/")
def read_root():
    return {"status": "Digital Agriculture Officer API is running with Groq."}

@app.post("/chat")
async def handle_chat(request: ChatRequest):
    # This function remains unchanged and works well.
    logger.info(f"Received Groq chat request: '{request.message}' in {request.language}")
    try:
        system_prompt = f"""You are a helpful Digital Agriculture Officer.
        Your entire response MUST be in the user's selected language, which is {request.language}.
        Do not apologize, refuse, or switch languages. Respond directly and concisely in {request.language}."""
        
        chat_completion = client.chat.completions.create(
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': request.message},
            ],
            model=MODEL_NAME,
        )
        response_content = chat_completion.choices[0].message.content
        logger.info("Successfully received response from Groq.")
        return {"reply": response_content}
    except Exception as e:
        logger.error(f"Error communicating with Groq: {e}")
        raise HTTPException(status_code=500, detail="Error communicating with the AI model.")

DIAGNOSIS_HEADERS = {
    "English": {"identification": "Identification", "actions": "Immediate Actions", "treatment": "Treatment Plan", "prevention": "Prevention Tips"},
    "Kannada": {"identification": "ಗುರುತಿಸುವಿಕೆ", "actions": "ತಕ್ಷಣದ ಕ್ರಮಗಳು", "treatment": "ಚಿಕಿತ್ಸಾ ಯೋಜನೆ", "prevention": "ತಡೆಗಟ್ಟುವಿಕೆ ಸಲಹೆಗಳು"},
    "Malayalam": {"identification": "തിരിച്ചറിയൽ", "actions": "ഉടനടി സ്വീകരിക്കേണ്ട നടപടികൾ", "treatment": "ചികിത്സാ പദ്ധതി", "prevention": "പ്രതിരോധത്തിനുള്ള നുറുങ്ങുകൾ"}
}

@app.post("/diagnose")
async def handle_diagnose(
    file: UploadFile = File(...),
    language: str = Form("English")
):
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Temporarily saved uploaded file to: {file_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not save file.")

    try:
        result = classify_real_image(file_path)
        disease, confidence = result["disease"], result["confidence"]
        headers = DIAGNOSIS_HEADERS.get(language, DIAGNOSIS_HEADERS["English"])

        # --- NEW, SMARTER PROMPT ---
        # This gives the AI clear conditional logic to follow.
        prompt = f"""
        You are an expert Digital Agriculture Officer. An image has been analyzed, and the object is identified as: "{disease}".

        **Your Task:**
        Based on this identification, provide a simple and helpful advisory to a farmer in **{language}**.

        **Follow these rules precisely:**

        1.  **Is "{disease}" a plant, fruit, vegetable, or a known pest?**
            * **If YES:** Write a helpful agricultural advisory using the following Markdown structure with the provided headers:
                - ## {headers['identification']}
                - ## {headers['actions']}
                - ## {headers['treatment']}
                - ## {headers['prevention']}
            * **If NO (e.g., it's a car, a tool, an animal):** Simply state in a friendly tone what you see and mention that it does not appear to be a crop issue. Do not use the headers. For example: "The image appears to show a {disease}. This does not seem to be a crop-related problem."

        2.  **LANGUAGE:** Your entire response must be in **{language}**. Do not use any other language.
        3.  **TONE:** Be friendly, simple, and direct.
        """

        logger.info("Sending new, smarter diagnosis prompt to Groq.")
        chat_completion = client.chat.completions.create(
            messages=[{'role': 'user', 'content': prompt}],
            model=MODEL_NAME,
        )
        response_content = chat_completion.choices[0].message.content
        logger.info("Successfully received advisory from Groq.")
        
        return {
            "detected_disease": disease,
            "confidence": confidence,
            "advisory": response_content
        }
    except Exception as e:
        logger.error(f"Error during Groq diagnosis process: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during the diagnosis.")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Removed temporary file: {file_path}")

