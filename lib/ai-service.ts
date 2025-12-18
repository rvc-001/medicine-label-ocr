import { generateText } from "ai"
import type { MedicineInfo } from "./types"

export async function getMedicineInfo(medicineName: string): Promise<MedicineInfo> {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `You are a medical information assistant with access to verified pharmaceutical databases and medical literature. Research and provide comprehensive, verified information about the medicine "${medicineName}".

IMPORTANT: Cross-reference information from multiple reliable sources like FDA, NIH, WebMD, Drugs.com, and official pharmaceutical databases to ensure accuracy.

Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "genericName": "the generic/chemical name",
  "brandNames": ["list", "of", "brand", "names"],
  "drugClass": "therapeutic drug class (e.g., NSAID, Antibiotic, etc.)",
  "description": "A comprehensive 3-4 sentence description of what this medicine is, how it works, and its primary purpose",
  "commonUses": "Detailed description of conditions this medicine treats (3-4 sentences)",
  "dosageInfo": "General dosage information and forms available (tablets, liquid, etc.) - do not give specific doses",
  "sideEffects": {
    "common": ["list of 5-7 common side effects"],
    "serious": ["list of 3-5 serious side effects requiring medical attention"]
  },
  "warnings": ["list of 4-5 important warnings and precautions"],
  "interactions": ["list of 4-5 common drug interactions to be aware of"],
  "generalSafety": "General safety information including who should avoid this medication (2-3 sentences)",
  "verified": true,
  "sources": ["FDA Drug Database", "NIH MedlinePlus", "appropriate verified sources"]
}

Ensure all information is factual, medically accurate, and from verified sources. If you cannot verify information, set verified to false.`,
    })

    const cleanedText = text.trim().replace(/```json\n?|\n?```/g, "")
    const info = JSON.parse(cleanedText) as MedicineInfo

    return info
  } catch (error) {
    console.error("[v0] AI service error:", error)
    throw new Error("Failed to generate medicine information")
  }
}

export async function analyzeImageForMedicines(imageBase64: string): Promise<{
  detectedObjects: Array<{
    name: string
    type: string
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number }
  }>
  extractedText: string[]
  medicineCandidates: string[]
}> {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageBase64,
            },
            {
              type: "text",
              text: `Analyze this image for medicine-related content. Identify:
1. Any medicine bottles, boxes, blister packs, or pharmaceutical packaging
2. All text visible on labels (medicine names, dosages, manufacturers)
3. Any medicine names or drug names you can identify

Return ONLY a JSON object with this exact structure (no markdown):
{
  "detectedObjects": [
    {
      "name": "description of object (e.g., 'Medicine bottle', 'Pill box')",
      "type": "bottle|box|blister|tube|other",
      "confidence": 0.0-1.0,
      "boundingBox": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100}
    }
  ],
  "extractedText": ["all", "text", "found", "on", "labels"],
  "medicineCandidates": ["medicine names identified from the image"]
}

Be thorough - identify ALL medicine names, generic names, and brand names visible.`,
            },
          ],
        },
      ],
    })

    const cleanedText = text.trim().replace(/```json\n?|\n?```/g, "")
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error("[v0] Image analysis error:", error)
    return {
      detectedObjects: [],
      extractedText: [],
      medicineCandidates: [],
    }
  }
}
