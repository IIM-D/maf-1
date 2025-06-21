import { type NextRequest, NextResponse } from "next/server"
import { runExperiment } from "@/lib/experiment-runner"

export async function POST(request: NextRequest) {
  try {
    const { config, experimentId } = await request.json()

    console.log("Starting experiment:", experimentId, "with config:", config)

    // Validate config
    if (!config || !config.framework || !config.gridSize) {
      return NextResponse.json({ error: "Invalid experiment configuration" }, { status: 400 })
    }

    // Start the experiment asynchronously
    const results = await runExperiment(config, experimentId)

    console.log("Experiment completed:", experimentId, "results:", results)

    return NextResponse.json({
      success: true,
      experimentId,
      results,
    })
  } catch (error) {
    console.error("Experiment error:", error)
    return NextResponse.json(
      {
        error: "Failed to run experiment",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
