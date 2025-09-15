'use client';

import { useState, useRef, FormEvent, ChangeEvent, useEffect } from 'react';
import { sendChatMessage, uploadForDiagnosis, Message } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- INTERNATIONALIZATION (i18n) CONTENT ---
const translations = {
  English: {
    title: "Digital Agriculture Officer",
    greeting: "Hello! I'm your Digital Agriculture Officer. How can I help you today?",
    placeholder: "Ask about crops, weather, or upload an image...",
    upload_aria: "Upload an image",
    camera_aria: "Use camera",
    take_photo: "Take Photo",
    close_camera: "Close Camera",
    diagnosis_prompt: "Image for diagnosis:",
    error_api: "Sorry, there was an error:",
    diagnosis_result: "Diagnosis Result:",
    detected_disease: "Detected Disease:",
    confidence: "Confidence:",
  },
  Kannada: {
    title: "ಡಿಜಿಟಲ್ ಕೃಷಿ ಅಧಿಕಾರಿ",
    greeting: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಡಿಜಿಟಲ್ ಕೃಷಿ ಅಧಿಕಾರಿ. ಇಂದು ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
    placeholder: "ಬೆಳೆಗಳು, ಹವಾಮಾನದ ಬಗ್ಗೆ ಕೇಳಿ ಅಥವಾ ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ...",
    upload_aria: "ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    camera_aria: "ಕ್ಯಾಮೆರಾ ಬಳಸಿ",
    take_photo: "ಫೋಟೋ ತೆಗೆಯಿರಿ",
    close_camera: "ಕ್ಯಾಮೆರಾ ಮುಚ್ಚಿ",
    diagnosis_prompt: "ರೋಗನಿರ್ಣಯಕ್ಕಾಗಿ ಚಿತ್ರ:",
    error_api: "ಕ್ಷಮಿಸಿ, ದೋಷ ಸಂಭವಿಸಿದೆ:",
    diagnosis_result: "ರೋಗನಿರ್ಣಯದ ಫಲಿತಾಂಶ:",
    detected_disease: "ಪತ್ತೆಯಾದ ರೋಗ:",
    confidence: "ವಿಶ್ವಾಸ:",
  },
  Malayalam: {
    title: "ഡിജിറ്റൽ കൃഷി ഓഫീസർ",
    greeting: "നമസ്കാരം! ഞാൻ നിങ്ങളുടെ ഡിജിറ്റൽ കൃഷി ഓഫീസർ. ഇന്ന് ഞാൻ എങ്ങനെ സഹായിക്കും?",
    placeholder: "വിളകളെക്കുറിച്ചോ കാലാവസ്ഥയെക്കുറിച്ചോ ചോദിക്കുക, അല്ലെങ്കിൽ ഒരു ചിത്രം അപ്‌ലോഡ് ചെയ്യുക...",
    upload_aria: "ഒരു ചിത്രം അപ്‌ലോഡ് ചെയ്യുക",
    camera_aria: "ക്യാമറ ഉപയോഗിക്കുക",
    take_photo: "ഫോട്ടോ എടുക്കുക",
    close_camera: "ക്യാമറ അടയ്ക്കുക",
    diagnosis_prompt: "രോഗനിർണയത്തിനുള്ള ചിത്രം:",
    error_api: "ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു:",
    diagnosis_result: "രോഗനിർണയ ഫലം:",
    detected_disease: "കണ്ടെത്തിയ രോഗം:",
    confidence: "ആത്മവിശ്വാസം:",
  }
};

type Language = keyof typeof translations;

// We add an optional imageUrl to our Message type for UI purposes
interface UIMessage extends Message {
    imageUrl?: string | null;
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('English');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const uiText = translations[language];

  useEffect(() => {
    setMessages([{ role: 'assistant', content: uiText.greeting }]);
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isCameraOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen, stream]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleOpenCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(mediaStream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "camera-shot.jpg", { type: "image/jpeg" });
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }, 'image/jpeg');
      handleCloseCamera();
    }
  };

  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setStream(null);
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;

    setIsLoading(true);
    const userMessageContent = input.trim() || `${uiText.diagnosis_prompt}`;
    
    const newUserMessage: UIMessage = { 
        role: 'user', 
        content: userMessageContent,
        imageUrl: previewUrl 
    };

    const currentHistoryWithUI = [...messages, newUserMessage];
    setMessages(currentHistoryWithUI);
    setInput('');
    setPreviewUrl(null); 
    const fileToSend = selectedFile;
    setSelectedFile(null); 

    try {
      let botResponse: UIMessage;
      if (fileToSend) {
        const data = await uploadForDiagnosis(fileToSend, language);
        const formattedAdvisory = `**${uiText.diagnosis_result}**\n\n- **${uiText.detected_disease}** ${data.detected_disease}\n- **${uiText.confidence}** ${Math.round(data.confidence * 100)}%\n\n---\n\n${data.advisory}`;
        botResponse = { role: 'assistant', content: formattedAdvisory };
      } else {
        const apiHistory = currentHistoryWithUI.map(({ role, content }) => ({ role, content }));
        const data = await sendChatMessage(apiHistory, language);
        botResponse = { role: 'assistant', content: data.reply };
      }
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      const errorResponse: UIMessage = { role: 'assistant', content: `${uiText.error_api} ${errorMessage}` };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
      if (newUserMessage.imageUrl) {
        URL.revokeObjectURL(newUserMessage.imageUrl);
      }
    }
  };

  return (
    <>
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90">
          <video ref={videoRef} autoPlay playsInline className="h-auto w-full max-w-2xl rounded-lg"></video>
          <div className="mt-4 flex gap-4">
            <button onClick={handleTakePhoto} className="rounded-full bg-green-600 px-6 py-3 text-lg text-white">{uiText.take_photo}</button>
            <button onClick={handleCloseCamera} className="rounded-full bg-gray-600 px-6 py-3 text-lg text-white">{uiText.close_camera}</button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      <div className="flex h-screen w-full flex-col">
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-lg dark:bg-gray-800">
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 dark:border-gray-700">
            <h1 className="text-lg font-semibold">🌱 {uiText.title}</h1>
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="rounded-md border bg-transparent px-3 py-1 text-sm focus:outline-none dark:border-gray-600">
              <option value="English">English</option>
              <option value="Kannada">ಕನ್ನಡ</option>
              <option value="Malayalam">മലയാളം</option>
            </select>
          </header>

          <main className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[80%] rounded-xl p-3 text-base ${msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-800'}`}>
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="User upload preview" className="mt-2 max-w-[200px] rounded-lg" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </main>

          <footer className="shrink-0 border-t p-4 dark:border-gray-700">
            {previewUrl && !isLoading && (
              <div className="relative mb-2 w-24">
                <img src={previewUrl} alt="Selected preview" className="h-24 w-24 rounded-md object-cover"/>
                <button onClick={clearAttachment} className="absolute -right-2 -top-2 rounded-full bg-gray-700 p-1 text-white hover:bg-black">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={uiText.placeholder}
                disabled={isLoading}
                className="w-full resize-none rounded-lg border-gray-300 p-3 pr-32 focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} aria-label={uiText.upload_aria} className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <button type="button" onClick={handleOpenCamera} disabled={isLoading} aria-label={uiText.camera_aria} className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                </button>
                <button type="submit" disabled={isLoading || (!input.trim() && !selectedFile)} className="rounded-full bg-green-600 p-2 text-white hover:bg-green-700 disabled:bg-gray-400">
                  {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"></div> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>}
                </button>
              </div>
            </form>
          </footer>
        </div>
      </div>
    </>
  );
}