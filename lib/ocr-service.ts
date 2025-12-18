import Tesseract from "tesseract.js"
import type { DetectedMedicine } from "./types"
import { analyzeImageForMedicines } from "./ai-service"

const MEDICINE_KEYWORDS = [
  // Pain relievers
  "ibuprofen",
  "paracetamol",
  "acetaminophen",
  "aspirin",
  "naproxen",
  "diclofenac",
  "tramadol",
  "codeine",
  "morphine",
  // Antibiotics
  "amoxicillin",
  "azithromycin",
  "ciprofloxacin",
  "doxycycline",
  "penicillin",
  "cephalexin",
  "metronidazole",
  "clindamycin",
  // Cardiovascular
  "metformin",
  "lisinopril",
  "atorvastatin",
  "amlodipine",
  "simvastatin",
  "losartan",
  "hydrochlorothiazide",
  "metoprolol",
  "carvedilol",
  "warfarin",
  "clopidogrel",
  // GI
  "omeprazole",
  "pantoprazole",
  "ranitidine",
  "famotidine",
  "lansoprazole",
  "esomeprazole",
  // Thyroid
  "levothyroxine",
  "synthroid",
  // Neurological
  "gabapentin",
  "pregabalin",
  "sertraline",
  "fluoxetine",
  "escitalopram",
  "duloxetine",
  "venlafaxine",
  "alprazolam",
  "lorazepam",
  "diazepam",
  // Steroids
  "prednisone",
  "prednisolone",
  "dexamethasone",
  "hydrocortisone",
  // Allergy
  "cetirizine",
  "loratadine",
  "diphenhydramine",
  "fexofenadine",
  "montelukast",
  // Diabetes
  "insulin",
  "glipizide",
  "glyburide",
  "sitagliptin",
  // Others
  "albuterol",
  "fluticasone",
  "salbutamol",
  "amitriptyline",
  "cyclobenzaprine",
]

export async function performOCR(canvas: HTMLCanvasElement): Promise<DetectedMedicine[]> {
  try {
    console.log("[v0] Starting enhanced OCR processing...")

    // Get image as base64 for AI analysis
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8)

    // Run Tesseract OCR and AI analysis in parallel
    const [tesseractResult, aiAnalysis] = await Promise.all([
      Tesseract.recognize(canvas, "eng", {
        logger: (m) => console.log("[v0] Tesseract:", m.status),
      }),
      analyzeImageForMedicines(imageBase64),
    ])

    console.log("[v0] Tesseract OCR completed. Text:", tesseractResult.data.text)
    console.log("[v0] AI Analysis completed:", aiAnalysis)

    const detectedMedicines: DetectedMedicine[] = []
    const foundMedicines = new Set<string>()

    // Process AI-detected medicines first (higher accuracy)
    if (aiAnalysis.medicineCandidates && aiAnalysis.medicineCandidates.length > 0) {
      aiAnalysis.medicineCandidates.forEach((medicine, index) => {
        const normalizedName = medicine.toLowerCase().trim()
        if (!foundMedicines.has(normalizedName) && normalizedName.length > 2) {
          foundMedicines.add(normalizedName)

          // Try to find position from detected objects
          let position = { x: 30 + ((index * 15) % 40), y: 30 + ((index * 10) % 40) }

          if (aiAnalysis.detectedObjects && aiAnalysis.detectedObjects[0]) {
            const obj = aiAnalysis.detectedObjects[0]
            position = {
              x: obj.boundingBox.x + obj.boundingBox.width / 2,
              y: obj.boundingBox.y + obj.boundingBox.height / 2,
            }
          }

          detectedMedicines.push({
            id: `ai-${medicine}-${Date.now()}-${Math.random()}`,
            name: medicine.charAt(0).toUpperCase() + medicine.slice(1).toLowerCase(),
            position,
            confidence: 0.95,
          })
          console.log(`[v0] AI detected medicine: ${medicine}`)
        }
      })
    }

    // Process Tesseract results for any missed medicines
    const words = tesseractResult.data.words || []
    const text = tesseractResult.data.text.toLowerCase()

    // Check against known medicine keywords
    MEDICINE_KEYWORDS.forEach((medicine) => {
      if (text.includes(medicine) && !foundMedicines.has(medicine)) {
        foundMedicines.add(medicine)
        console.log(`[v0] Tesseract found medicine: ${medicine}`)

        const word = words.find((w: any) => w.text.toLowerCase().includes(medicine))

        let position = { x: 50, y: 50 }
        let confidence = 0.8

        if (word && word.bbox) {
          const x = ((word.bbox.x0 + word.bbox.x1) / 2 / canvas.width) * 100
          const y = ((word.bbox.y0 + word.bbox.y1) / 2 / canvas.height) * 100
          position = { x, y }
          confidence = word.confidence / 100
        } else {
          position = {
            x: 30 + Math.random() * 40,
            y: 30 + Math.random() * 40,
          }
        }

        detectedMedicines.push({
          id: `ocr-${medicine}-${Date.now()}-${Math.random()}`,
          name: medicine.charAt(0).toUpperCase() + medicine.slice(1),
          position,
          confidence,
        })
      }
    })

    // Also check extracted text from AI for additional medicines
    if (aiAnalysis.extractedText) {
      aiAnalysis.extractedText.forEach((textItem) => {
        const lowerText = textItem.toLowerCase()
        MEDICINE_KEYWORDS.forEach((medicine) => {
          if (lowerText.includes(medicine) && !foundMedicines.has(medicine)) {
            foundMedicines.add(medicine)
            detectedMedicines.push({
              id: `extract-${medicine}-${Date.now()}-${Math.random()}`,
              name: medicine.charAt(0).toUpperCase() + medicine.slice(1),
              position: { x: 40 + Math.random() * 20, y: 40 + Math.random() * 20 },
              confidence: 0.85,
            })
          }
        })
      })
    }

    console.log("[v0] Total medicines detected:", detectedMedicines.length)
    return detectedMedicines
  } catch (error) {
    console.error("[v0] OCR processing error:", error)
    return []
  }
}
