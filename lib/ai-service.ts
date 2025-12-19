"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import type { MedicineInfo } from "./types"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "")

// --- 1. SEARCH SERVICE (NO AI - PURE LINKS) ---
// This is called when you tap a medicine. It returns links instantly.
export async function getMedicineInfo(medicineName: string): Promise<MedicineInfo> {
  const cleanName = medicineName.trim()
  
  return {
    verified: true,
    genericName: cleanName,
    brandNames: [cleanName],
    drugClass: "Search Result",
    description: `Verified details are available via the search links below. Click to view full medical information on 1mg, Drugs.com, or Google.`,
    commonUses: "Click links below to view uses.",
    dosageInfo: "Refer to official packaging or links.",
    sideEffects: {
      common: ["See official label"],
      serious: ["Consult a doctor"]
    },
    warnings: ["Verify details with a pharmacist."],
    interactions: ["Check official sources."],
    generalSafety: "Always consult a doctor before use.",
    sources: [
      `https://www.google.com/search?q=${encodeURIComponent(cleanName + " medicine")}`,
      `https://www.1mg.com/search/all?name=${encodeURIComponent(cleanName)}`,
      `https://www.drugs.com/search.php?searchterm=${encodeURIComponent(cleanName)}`,
      `https://medlineplus.gov/search?q=${encodeURIComponent(cleanName)}`
    ]
  }
}

// --- 2. VISION SERVICE (SMART AI FALLBACK) ---
// This uses AI just to read the label.
export async function analyzeImageForMedicines(imageBase64: string): Promise<{
  detectedObjects: Array<any>
  extractedText: string[]
  medicineCandidates: string[]
}> {
  try {
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64

    // Helper to try 2.0 first, then 1.5 if busy
    const tryModel = async (modelName: string) => {
      console.log(`[AI] Analyzing with ${modelName}...`)
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        `Analyze this image. 
        Task: Identify the FULL MEDICINE NAME (e.g. "Dolo 650", "Augmentin 625").
        Ignore isolated numbers.
        
        Return ONLY JSON:
        {
          "detectedObjects": [{"name": "Bottle", "type": "container", "confidence": 0.9, "boundingBox": {"x":50,"y":50,"width":0,"height":0}}],
          "extractedText": ["visible text"],
          "medicineCandidates": ["Exact Name Found"]
        }`,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
      ])
      return result.response.text()
    }

    let responseText
    try {
      responseText = await tryModel("gemini-2.5-flash")
    } catch (e) {
      console.warn("[AI] Gemini 2.0 busy, switching to 1.5 Flash...")
      responseText = await tryModel("gemini-1.5-flash")
    }

    const cleaned = responseText.trim().replace(/^```json\s*|```$/g, "").replace(/^\s*|\s*$/g, "")
    return JSON.parse(cleaned)

  } catch (error) {
    console.error("[AI] Vision Failed:", error)
    return { detectedObjects: [], extractedText: [], medicineCandidates: [] }
  }
}