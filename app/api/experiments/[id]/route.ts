import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const experimentId = params.id

    // Stop the experiment (implementation depends on your experiment runner)
    // This would typically involve canceling ongoing processes

    return NextResponse.json({
      success: true,
      message: `Experiment ${experimentId} stopped`,
    })
  } catch (error) {
    console.error("Stop experiment error:", error)
    return NextResponse.json({ error: "Failed to stop experiment" }, { status: 500 })
  }
}
