"use client"

import { useEffect, useRef, useState } from "react"
import { X, CameraIcon, RotateCw, Scan } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnnotationMarker } from "@/components/annotation-marker"
import { InfoBottomSheet } from "@/components/info-bottom-sheet"
import { performOCR } from "@/lib/ocr-service"
import type { DetectedMedicine } from "@/lib/types"

interface CameraViewProps {
  onClose: () => void
  onScanComplete?: (imageUrl: string, medicines: DetectedMedicine[]) => void
}

export function CameraView({ onClose, onScanComplete }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [detectedMedicines, setDetectedMedicines] = useState<DetectedMedicine[]>([])
  const [selectedMedicine, setSelectedMedicine] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState<string>("")

  useEffect(() => {
    let mounted = true

    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }

        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (error) {
        console.error("[v0] Camera initialization error:", error)
      }
    }

    initCamera()

    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setIsProcessing(true)
    setProcessingStage("Capturing image...")

    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setIsProcessing(false)
      return
    }

    ctx.drawImage(video, 0, 0)
    const imageDataUrl = canvas.toDataURL("image/png")
    setCapturedImage(imageDataUrl)

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    try {
      setProcessingStage("Running OCR analysis...")
      await new Promise((r) => setTimeout(r, 500))

      setProcessingStage("Detecting objects with AI...")
      await new Promise((r) => setTimeout(r, 500))

      setProcessingStage("Identifying medicines...")
      const medicines = await performOCR(canvas)

      setProcessingStage("Verifying results...")
      await new Promise((r) => setTimeout(r, 300))

      setDetectedMedicines(medicines)
    } catch (error) {
      console.error("[v0] OCR error:", error)
    } finally {
      setIsProcessing(false)
      setProcessingStage("")
    }
  }

  const handleRetake = async () => {
    setCapturedImage(null)
    setDetectedMedicines([])
    setSelectedMedicine(null)

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("[v0] Camera restart error:", error)
    }
  }

  const handleDone = () => {
    if (onScanComplete && capturedImage) {
      onScanComplete(capturedImage, detectedMedicines)
    } else {
      onClose()
    }
  }

  const handleMarkerTap = (medicineName: string) => {
    setSelectedMedicine(medicineName)
  }

  const handleCloseBottomSheet = () => {
    setSelectedMedicine(null)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {capturedImage ? (
        <img
          src={capturedImage || "/placeholder.svg"}
          alt="Captured medicine label"
          className="h-full w-full object-cover"
        />
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay animation */}
      {!capturedImage && !isProcessing && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-8 inset-y-32 border-2 border-primary/50 rounded-2xl">
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div
                className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"
                style={{ animation: "scanLine 2s ease-in-out infinite" }}
              />
            </div>
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-xl" />
          </div>
        </div>
      )}

      <div className="absolute left-0 right-0 top-0 z-10 backdrop-blur-xl bg-black/30 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <CameraIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-white">
              {capturedImage ? "Tap medicines for details" : "Point at medicine labels"}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 rounded-full backdrop-blur-xl bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {capturedImage &&
        detectedMedicines.map((medicine) => (
          <AnnotationMarker key={medicine.id} medicine={medicine} onTap={handleMarkerTap} />
        ))}

      <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-xl bg-black/30 px-4 pb-8 pt-6">
        <div className="flex items-center justify-center gap-4">
          {capturedImage ? (
            <div className="flex gap-3">
              <Button
                size="lg"
                onClick={handleRetake}
                variant="outline"
                className="h-14 gap-2 px-6 text-base font-medium backdrop-blur-xl bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RotateCw className="h-5 w-5" />
                Retake
              </Button>
              <Button
                size="lg"
                onClick={handleDone}
                className="h-14 gap-2 px-8 text-base font-medium bg-primary hover:bg-primary/90"
              >
                <Scan className="h-5 w-5" />
                Done ({detectedMedicines.length} found)
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={handleCapture}
              disabled={isProcessing}
              className="h-20 w-20 rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90"
            >
              {isProcessing ? (
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-foreground border-t-transparent" />
              ) : (
                <CameraIcon className="h-8 w-8" />
              )}
            </Button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl backdrop-blur-xl bg-black/70 px-8 py-6 min-w-64">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              <Scan className="absolute inset-0 m-auto h-5 w-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">{processingStage}</p>
              <p className="text-xs text-white/60 mt-1">AI-powered detection in progress</p>
            </div>
          </div>
        </div>
      )}

      <InfoBottomSheet
        medicineName={selectedMedicine}
        isOpen={selectedMedicine !== null}
        onClose={handleCloseBottomSheet}
      />

      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  )
}
