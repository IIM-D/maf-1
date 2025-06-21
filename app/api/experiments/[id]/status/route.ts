import { type NextRequest, NextResponse } from "next/server"

// Mock data for demonstration - in a real implementation, this would come from your experiment runner
const mockEnvironmentStates = [
  {
    "0.5_0.5": ["target_blue"],
    "1.5_0.5": ["target_red"],
    "0_0": ["artifact_blue"],
    "1_1": ["artifact_red"],
    "2_2": [],
  },
  {
    "0.5_0.5": [],
    "1.5_0.5": ["target_red"],
    "0_0": [],
    "1_1": ["artifact_red"],
    "2_2": [],
  },
]

const mockDialogueMessages = [
  {
    id: "1",
    timestamp: Date.now() - 5000,
    agent: "Central Coordinator",
    message: "Analyzing current environment state. Planning optimal workpiece movements.",
    type: "central",
  },
  {
    id: "2",
    timestamp: Date.now() - 4000,
    agent: "Local LLM Agent Alpha",
    message: "I can see blue workpiece at corner [0,0]. Target is at [0.5,0.5].",
    type: "local-alpha",
  },
  {
    id: "3",
    timestamp: Date.now() - 3000,
    agent: "Local LLM Agent Beta",
    message: "Red workpiece detected at [1,1]. Checking for collision-free path.",
    type: "local-beta",
  },
]

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const experimentId = params.id

    // In a real implementation, you would fetch the actual experiment status
    // For now, we'll return mock data for demonstration

    const response = {
      experimentId,
      status: "running",
      environment: mockEnvironmentStates[Math.floor(Math.random() * mockEnvironmentStates.length)],
      dialogue:
        Math.random() > 0.7 ? [mockDialogueMessages[Math.floor(Math.random() * mockDialogueMessages.length)]] : [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Get experiment status error:", error)
    return NextResponse.json({ error: "Failed to get experiment status" }, { status: 500 })
  }
}
