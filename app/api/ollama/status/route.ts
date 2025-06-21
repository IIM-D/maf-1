import { NextResponse } from "next/server"
import { OllamaService } from "@/lib/ollama-service"

export async function GET() {
  try {
    const ollamaService = new OllamaService()
    const connectionStatus = await ollamaService.checkOllamaConnections()

    return NextResponse.json(connectionStatus)
  } catch (error) {
    console.error("Failed to check Ollama status:", error)
    return NextResponse.json({ error: "Failed to check Ollama connections" }, { status: 500 })
  }
}
