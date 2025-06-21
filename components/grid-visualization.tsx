"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Zap, MessageSquare } from "lucide-react"

interface GridEnvironment {
  [key: string]: string[]
}

interface DialogueMessage {
  id: string
  timestamp: number
  agent: string
  message: string
  type: "central" | "local-alpha" | "local-beta"
}

interface GridVisualizationProps {
  rows: number
  cols: number
  environment?: GridEnvironment
  onEnvironmentChange?: (env: GridEnvironment) => void
  isExperimentRunning?: boolean
  experimentId?: string
}

export function GridVisualization({
  rows,
  cols,
  environment,
  onEnvironmentChange,
  isExperimentRunning = false,
  experimentId,
}: GridVisualizationProps) {
  const [currentEnv, setCurrentEnv] = useState<GridEnvironment>({})
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>([])
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set())
  const dialogueEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (environment) {
      // Animate changes when environment updates
      if (Object.keys(currentEnv).length > 0) {
        animateEnvironmentChange(currentEnv, environment)
      }
      setCurrentEnv(environment)
    } else {
      generateRandomEnvironment()
    }
  }, [rows, cols, environment])

  useEffect(() => {
    // Auto-scroll to bottom of dialogue
    if (dialogueEndRef.current) {
      dialogueEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [dialogueMessages])

  useEffect(() => {
    // Set up real-time updates when experiment is running
    if (isExperimentRunning && experimentId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/experiments/${experimentId}/status`)
          if (response.ok) {
            const data = await response.json()
            if (data.environment) {
              setCurrentEnv(data.environment)
            }
            if (data.dialogue) {
              setDialogueMessages((prev) => [...prev, ...data.dialogue])
            }
          }
        } catch (error) {
          console.error("Failed to fetch experiment status:", error)
        }
      }, 1000) // Update every second

      return () => clearInterval(interval)
    }
  }, [isExperimentRunning, experimentId])

  const animateEnvironmentChange = (oldEnv: GridEnvironment, newEnv: GridEnvironment) => {
    const changedItems = new Set<string>()

    // Find items that moved
    for (const [position, items] of Object.entries(oldEnv)) {
      for (const item of items) {
        if (item.startsWith("artifact_")) {
          const newPosition = Object.entries(newEnv).find(([_, newItems]) => newItems.includes(item))?.[0]

          if (newPosition && newPosition !== position) {
            changedItems.add(item)
          }
        }
      }
    }

    if (changedItems.size > 0) {
      setAnimatingItems(changedItems)
      setTimeout(() => setAnimatingItems(new Set()), 1000) // Animation duration
    }
  }

  const generateRandomEnvironment = () => {
    const newEnv: GridEnvironment = {}
    const colors = ["blue", "red", "green", "purple", "orange"]

    // Initialize all positions
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        newEnv[`${i + 0.5}_${j + 0.5}`] = []
      }
    }

    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        newEnv[`${i}_${j}`] = []
      }
    }

    // Place artifacts and targets
    for (const color of colors) {
      const artifactCount = Math.floor(Math.random() * 2) + 1

      for (let k = 0; k < artifactCount; k++) {
        // Place artifact in random corner
        const artifactSquare = Math.floor(Math.random() * (rows * cols))
        const aArtifact = Math.floor(artifactSquare / cols)
        const bArtifact = artifactSquare % cols

        // Place target in random agent square
        const targetSquare = Math.floor(Math.random() * (rows * cols))
        const aTarget = Math.floor(targetSquare / cols)
        const bTarget = targetSquare % cols

        const cornerOptions = [
          [1.0, 0.0],
          [0.0, 0.0],
          [0.0, 1.0],
          [1.0, 1.0],
        ]

        const shuffledCorners = cornerOptions.sort(() => Math.random() - 0.5)

        for (const [randomX, randomY] of shuffledCorners) {
          const cornerKey = `${aArtifact + randomX}_${bArtifact + randomY}`
          if (newEnv[cornerKey].length === 0) {
            newEnv[cornerKey].push(`artifact_${color}`)
            newEnv[`${aTarget + 0.5}_${bTarget + 0.5}`].push(`target_${color}`)
            break
          }
        }
      }
    }

    setCurrentEnv(newEnv)
    onEnvironmentChange?.(newEnv)
  }

  const addSimulatedDialogue = (type: "central" | "local-alpha" | "local-beta", message: string) => {
    const agentNames = {
      central: "Central Coordinator",
      "local-alpha": "Local LLM Agent Alpha",
      "local-beta": "Local LLM Agent Beta",
    }

    const newMessage: DialogueMessage = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      agent: agentNames[type],
      message,
      type,
    }

    setDialogueMessages((prev) => [...prev, newMessage])
  }

  const simulateDialogue = () => {
    const messages = [
      {
        type: "central" as const,
        message: "Analyzing current environment state. Planning optimal workpiece movements.",
      },
      { type: "local-alpha" as const, message: "I can see blue workpiece at corner [1,0]. Target is at [0.5,0.5]." },
      { type: "local-beta" as const, message: "Red workpiece detected at [2,1]. Checking for collision-free path." },
      {
        type: "central" as const,
        message: "Coordinating movements: Alpha handle blue, Beta handle red. Avoid collision at [1,1].",
      },
      { type: "local-alpha" as const, message: "EXECUTE: move(artifact_blue, target_blue)" },
      { type: "local-beta" as const, message: "I Agree with the plan. Proceeding with red workpiece movement." },
    ]

    messages.forEach((msg, index) => {
      setTimeout(() => {
        addSimulatedDialogue(msg.type, msg.message)
      }, index * 2000)
    })
  }

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      blue: "bg-blue-500",
      red: "bg-red-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
    }
    return colorMap[color] || "bg-gray-500"
  }

  const getAgentTypeColor = (type: string) => {
    switch (type) {
      case "central":
        return "text-purple-600 bg-purple-50"
      case "local-alpha":
        return "text-blue-600 bg-blue-50"
      case "local-beta":
        return "text-green-600 bg-green-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const renderCell = (row: number, col: number) => {
    const agentKey = `${row + 0.5}_${col + 0.5}`
    const agentItems = currentEnv[agentKey] || []

    const corners = [
      { key: `${row}_${col}`, position: "top-left" },
      { key: `${row}_${col + 1}`, position: "top-right" },
      { key: `${row + 1}_${col}`, position: "bottom-left" },
      { key: `${row + 1}_${col + 1}`, position: "bottom-right" },
    ]

    return (
      <div
        key={`cell-${row}-${col}`}
        className={`relative border-2 border-gray-300 bg-gray-50 aspect-square cursor-pointer transition-all hover:bg-gray-100 ${
          selectedCell === agentKey ? "ring-2 ring-blue-500" : ""
        }`}
        onClick={() => setSelectedCell(selectedCell === agentKey ? null : agentKey)}
      >
        {/* Robot Label */}
        <div className="absolute top-1 left-1 text-xs font-mono text-gray-600">
          [{row + 0.5}, {col + 0.5}]
        </div>

        {/* Agent Square Items (Targets) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-wrap gap-1 max-w-full">
            {agentItems.map((item, idx) => {
              const color = item.split("_")[1]
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded border-2 border-white ${getColorClass(color)} flex items-center justify-center transition-all duration-300`}
                  title={item}
                >
                  <span className="text-xs text-white font-bold">T</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Corner Items (Workpieces) */}
        {corners.map(({ key, position }) => {
          const cornerItems = currentEnv[key] || []
          if (cornerItems.length === 0) return null

          const positionClasses = {
            "top-left": "top-0 left-0",
            "top-right": "top-0 right-0",
            "bottom-left": "bottom-0 left-0",
            "bottom-right": "bottom-0 right-0",
          }

          return (
            <div
              key={key}
              className={`absolute ${positionClasses[position as keyof typeof positionClasses]} w-6 h-6 flex items-center justify-center`}
            >
              {cornerItems.map((item, idx) => {
                const color = item.split("_")[1]
                const isAnimating = animatingItems.has(item)
                return (
                  <div
                    key={idx}
                    className={`w-5 h-5 rounded-full border-2 border-white ${getColorClass(color)} flex items-center justify-center shadow-sm transition-all duration-1000 ${
                      isAnimating ? "scale-110 shadow-lg ring-2 ring-yellow-400" : ""
                    }`}
                    title={`${item} at ${key}`}
                  >
                    <span className="text-xs text-white font-bold">W</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const getCellInfo = (agentKey: string) => {
    const agentItems = currentEnv[agentKey] || []
    const [row, col] = agentKey.split("_").map((n) => Number.parseFloat(n) - 0.5)

    const corners = [`${row}_${col}`, `${row}_${col + 1}`, `${row + 1}_${col}`, `${row + 1}_${col + 1}`]

    const cornerItems = corners.flatMap((corner) => (currentEnv[corner] || []).map((item) => ({ item, corner })))

    return { agentItems, cornerItems }
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            Environment: {rows}×{cols} Grid
          </h3>
          <p className="text-sm text-gray-600">
            Workpieces (W) are placed at corners, Targets (T) are in robot squares
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateRandomEnvironment} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Generate New Environment
          </Button>
          <Button onClick={simulateDialogue} variant="outline" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Simulate Dialogue
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-xs text-white font-bold">W</span>
          </div>
          <span className="text-sm">Workpieces (at corners)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500 border-2 border-white flex items-center justify-center">
            <span className="text-xs text-white font-bold">T</span>
          </div>
          <span className="text-sm">Target (in robot squares)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">[0.5, 0.5]</div>
          <span className="text-sm">Robot Position</span>
        </div>
      </div>

      {/* Grid and Dialogue */}
      <div className="flex gap-6">
        <div className="flex-1">
          <div
            className="grid gap-1 p-4 bg-white rounded-lg border"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              maxWidth: `${cols * 120}px`,
            }}
          >
            {Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => renderCell(row, col)))}
          </div>
        </div>

        {/* Dialogue Panel */}
        <div className="w-80 space-y-4">
          {/* Cell Details */}
          {selectedCell && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Robot {selectedCell}</CardTitle>
                <CardDescription>Cell details and available actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const { agentItems, cornerItems } = getCellInfo(selectedCell)
                  return (
                    <>
                      <div>
                        <h4 className="font-medium mb-2">Targets in Square:</h4>
                        {agentItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {agentItems.map((item, idx) => (
                              <Badge key={idx} variant="secondary">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No targets</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Workpieces at Corners:</h4>
                        {cornerItems.length > 0 ? (
                          <div className="space-y-1">
                            {cornerItems.map(({ item, corner }, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Badge variant="outline">{item}</Badge>
                                <span className="text-gray-500">at {corner}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No workpieces</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Possible Actions:</h4>
                        {cornerItems.length > 0 ? (
                          <div className="space-y-1 text-xs">
                            {cornerItems.map(({ item, corner }, idx) => {
                              const color = item.split("_")[1]
                              const hasMatchingTarget = agentItems.includes(`target_${color}`)
                              return (
                                <div key={idx} className="p-2 bg-gray-50 rounded">
                                  <div className="font-mono">
                                    move({item}, target_{color})
                                  </div>
                                  {hasMatchingTarget && (
                                    <div className="text-green-600 flex items-center gap-1 mt-1">
                                      <Zap className="w-3 h-3" />
                                      Can match with target!
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No actions available</p>
                        )}
                      </div>
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* Agent Dialogue */}
          <Card className="h-96">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Agent Dialogue
              </CardTitle>
              <CardDescription>Real-time communication between agents</CardDescription>
            </CardHeader>
            <CardContent className="h-64 overflow-y-auto space-y-2">
              {dialogueMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No dialogue messages yet</p>
                  <p className="text-xs">Start an experiment or simulate dialogue</p>
                </div>
              ) : (
                dialogueMessages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${getAgentTypeColor(msg.type)}`}>
                        {msg.agent}
                      </Badge>
                      <span className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm bg-gray-50 p-2 rounded text-gray-700">{msg.message}</div>
                  </div>
                ))
              )}
              <div ref={dialogueEndRef} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Environment Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {["blue", "red", "green", "purple", "orange"].map((color) => {
          const artifacts = Object.values(currentEnv)
            .flat()
            .filter((item) => item === `artifact_${color}`).length
          const targets = Object.values(currentEnv)
            .flat()
            .filter((item) => item === `target_${color}`).length

          return (
            <div key={color} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className={`w-6 h-6 rounded-full ${getColorClass(color)} mx-auto mb-2`}></div>
              <div className="text-sm font-medium capitalize">{color}</div>
              <div className="text-xs text-gray-600">
                {artifacts}W / {targets}T
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
