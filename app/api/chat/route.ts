import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
}

interface ChatContext {
  messages: ChatMessage[]
  language: string
  sessionId: string
}

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20
const MAX_CONTEXT_MESSAGES = 10
const MAX_TOKENS = 4000
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const sessionContexts = new Map<string, ChatContext>()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : "127.0.0.1"
  return ip
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(key)

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return false
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }

  record.count++
  return false
}

const getSystemPrompt = (language: string): string => {
  const prompts = {
    en: "You are a Digital Krishi Officer, an expert agricultural advisor. Provide practical, actionable advice for farmers. Focus on crop management, pest control, soil health, weather patterns, and sustainable farming practices. Keep responses concise and farmer-friendly.",
    hi: "आप एक डिजिटल कृषि अधिकारी हैं, एक विशेषज्ञ कृषि सलाहकार। किसानों के लिए व्यावहारिक, कार्यान्वित सलाह प्रदान करें। फसल प्रबंधन, कीट नियंत्रण, मिट्टी स्वास्थ्य, मौसम पैटर्न और टिकाऊ कृषि प्रथाओं पर ध्यान दें।",
    kn: "ನೀವು ಡಿಜಿಟಲ್ ಕೃಷಿ ಅಧಿಕಾರಿ, ಒಬ್ಬ ತಜ್ಞ ಕೃಷಿ ಸಲಹೆಗಾರ. ರೈತರಿಗೆ ಪ್ರಾಯೋಗಿಕವುം ನಟಪ್ಪಿಲಾಕ್ಕಾವುന್ನതುಮಾയ ಉಪದೇಶಂ ನൽಕುക. ಬೆಳೆ ನಿರ್ವಹಣೆ, ಕೀಟ ನಿಯಂತ್ರಣೆ, ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಮತ್ತು ಸುಸ್ಥಿರ ಕೃಷಿ ಅಭ್ಯಾಸಗಳ ಮೇಲೆ ಗಮನಹರಿಸಿ।",
    ml: "നിങ്ങൾ ഒരു ഡിജിറ്റൽ കൃഷി ഓഫീസറാണ്, ഒരു വിദഗ്ധ കാർഷിക ഉപദേശകൻ. കർഷകർക്ക് പ്രായോഗികവും നടപ്പിലാക്കാവുന്നതുമായ ഉപദേശം നൽകുക. വിള പരിാലനം, കീടനിയന്ത്രണം, മണ്ണിന്റെ ആരോഗ്യം, കാലാവസ്ഥാ രീതികൾ എന്നിവയിൽ ശ്രദ്ധ കേന്ദ്രീകരിക്കുക।",
  }
  return prompts[language as keyof typeof prompts] || prompts.en
}

const getOrCreateContext = (sessionId: string, language: string): ChatContext => {
  if (!sessionContexts.has(sessionId)) {
    sessionContexts.set(sessionId, {
      messages: [{ role: "system", content: getSystemPrompt(language) }],
      language,
      sessionId,
    })
  }
  return sessionContexts.get(sessionId)!
}

const addMessageToContext = (sessionId: string, message: ChatMessage): void => {
  const context = sessionContexts.get(sessionId)
  if (context) {
    context.messages.push(message)
    if (context.messages.length > MAX_CONTEXT_MESSAGES) {
      const systemMessage = context.messages[0]
      const recentMessages = context.messages.slice(-MAX_CONTEXT_MESSAGES + 1)
      context.messages = [systemMessage, ...recentMessages]
    }
  }
}

const callLLM = async (messages: ChatMessage[], language: string): Promise<string> => {
  // ============================================================================
  // 🔗 LLM INTEGRATION POINT - GEMINI AI (ACTIVE)
  // ============================================================================

  try {
    // Convert messages to Gemini format
    const prompt = messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")

    const systemPrompt = messages.find((m) => m.role === "system")?.content || ""
    const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nassistant:`

    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    const result = await model.generateContent(fullPrompt)
    return result.response.text()
  } catch (error) {
    console.error("Gemini API Error:", error)
    throw new Error("Failed to get response from Gemini AI")
  }

  // ============================================================================
  // 🔗 OPENAI INTEGRATION (COMMENTED FOR FUTURE USE)
  // ============================================================================
  //
  // Uncomment this section when you want to switch to OpenAI:
  //
  // try {
  //   const { OpenAI } = require('openai')
  //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  //   const completion = await openai.chat.completions.create({
  //     model: "gpt-4",
  //     messages: messages,
  //     temperature: 0.7,
  //     max_tokens: 1000
  //   })
  //   return completion.choices[0].message.content || "Sorry, I couldn't generate a response."
  // } catch (error) {
  //   console.error('OpenAI API Error:', error)
  //   throw new Error('Failed to get response from OpenAI')
  // }
  // ============================================================================
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitKey = getRateLimitKey(request)
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json({ success: false, error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const body = await request.json()
    const { message, language = "en", image, sessionId = crypto.randomUUID() } = body

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ success: false, error: "Message too long. Maximum 2000 characters." }, { status: 400 })
    }

    const validLanguages = ["en", "hi", "kn", "ml"]
    if (language && !validLanguages.includes(language)) {
      return NextResponse.json({ success: false, error: "Invalid language" }, { status: 400 })
    }

    const context = getOrCreateContext(sessionId, language)

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }
    addMessageToContext(sessionId, userMessage)

    // ============================================================================
    // 🔗 MAIN API INTEGRATION POINT - LLM SERVICE CALL
    // ============================================================================
    // This is where the actual LLM service gets called with the conversation context
    const llmResponse = await callLLM(context.messages, language)

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: llmResponse,
      timestamp: new Date().toISOString(),
    }
    addMessageToContext(sessionId, assistantMessage)

    let imageAnalysis = null
    if (image) {
      // ============================================================================
      // 🔗 IMAGE ANALYSIS INTEGRATION POINT - GEMINI VISION (ACTIVE)
      // ============================================================================

      try {
        const visionModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" })
        const result = await visionModel.generateContent([
          "Analyze this crop/plant image and provide detailed agricultural advice in " + language,
          { inlineData: { data: image.split(",")[1], mimeType: "image/jpeg" } },
        ])
        imageAnalysis = result.response.text()
      } catch (error) {
        console.error("Gemini Vision Error:", error)
        imageAnalysis = "Image analysis temporarily unavailable. Please try again later."
      }

      // ============================================================================
      // 🔗 OPENAI VISION INTEGRATION (COMMENTED FOR FUTURE USE)
      // ============================================================================
      //
      // Uncomment this section when you want to use OpenAI Vision:
      //
      // try {
      //   const visionResponse = await openai.chat.completions.create({
      //     model: "gpt-4-vision-preview",
      //     messages: [{ role: "user", content: [
      //       { type: "text", text: `Analyze this agricultural image and provide farming advice in ${language}` },
      //       { type: "image_url", image_url: { url: image } }
      //     ]}]
      //   })
      //   imageAnalysis = visionResponse.choices[0].message.content
      // } catch (error) {
      //   console.error('OpenAI Vision Error:', error)
      //   imageAnalysis = "Image analysis temporarily unavailable."
      // }
      // ============================================================================
    }

    const response = {
      success: true,
      response: llmResponse,
      imageAnalysis,
      sessionId,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      contextLength: context.messages.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Chat API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error. Please try again later.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
}
