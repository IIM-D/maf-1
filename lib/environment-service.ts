export class EnvironmentService {
  createEnvironment(rows: number, cols: number) {
    const environment = new GridEnvironment(rows, cols)
    environment.initialize()
    return environment
  }
}

class GridEnvironment {
  private rows: number
  private cols: number
  private grid: { [key: string]: string[] } = {}
  private colors = ["blue", "red", "green", "purple", "orange"]

  constructor(rows: number, cols: number) {
    this.rows = rows
    this.cols = cols
  }

  initialize() {
    // Initialize grid positions
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        this.grid[`${i + 0.5}_${j + 0.5}`] = []
      }
    }

    for (let i = 0; i <= this.rows; i++) {
      for (let j = 0; j <= this.cols; j++) {
        this.grid[`${i}_${j}`] = []
      }
    }

    // Randomly place artifacts and targets
    this.placeArtifactsAndTargets()
  }

  private placeArtifactsAndTargets() {
    for (const color of this.colors) {
      const artifactCount = Math.floor(Math.random() * 2) + 1 // 1-2 artifacts per color

      for (let i = 0; i < artifactCount; i++) {
        // Place artifact
        const artifactPos = this.getRandomCornerPosition()
        if (this.grid[artifactPos].length === 0) {
          this.grid[artifactPos].push(`artifact_${color}`)
        }

        // Place target
        const targetPos = this.getRandomSquarePosition()
        this.grid[targetPos].push(`target_${color}`)
      }
    }
  }

  private getRandomCornerPosition(): string {
    const row = Math.floor(Math.random() * this.rows)
    const col = Math.floor(Math.random() * this.cols)
    const corners = [`${row}_${col}`, `${row}_${col + 1}`, `${row + 1}_${col}`, `${row + 1}_${col + 1}`]
    return corners[Math.floor(Math.random() * corners.length)]
  }

  private getRandomSquarePosition(): string {
    const row = Math.floor(Math.random() * this.rows)
    const col = Math.floor(Math.random() * this.cols)
    return `${row + 0.5}_${col + 0.5}`
  }

  getStatePrompt(): string {
    let prompt = ""

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const squareKey = `${i + 0.5}_${j + 0.5}`
        const squareItems = this.grid[squareKey]

        prompt += `Agent[${i + 0.5}, ${j + 0.5}]: I am in square[${i + 0.5}, ${j + 0.5}], I can observe ${JSON.stringify(squareItems)}, I can do `

        const actions = this.getAvailableActions(i, j)
        prompt += `${JSON.stringify(actions)}\n`
      }
    }

    return prompt
  }

  private getAvailableActions(row: number, col: number): string[] {
    const actions: string[] = []
    const corners = [`${row}_${col}`, `${row}_${col + 1}`, `${row + 1}_${col}`, `${row + 1}_${col + 1}`]

    for (const corner of corners) {
      const items = this.grid[corner]
      if (items.length === 1 && items[0].startsWith("artifact_")) {
        const artifact = items[0]
        const color = artifact.split("_")[1]

        // Can move to other corners
        for (const otherCorner of corners) {
          if (otherCorner !== corner) {
            const [x, y] = otherCorner.split("_").map(Number)
            actions.push(`move(${artifact}, position[${x}, ${y}])`)
          }
        }

        // Can move to target if available
        const squareKey = `${row + 0.5}_${col + 0.5}`
        if (this.grid[squareKey].includes(`target_${color}`)) {
          actions.push(`move(${artifact}, target_${color})`)
        }
      }
    }

    return actions
  }

  getAgents() {
    const agents = []
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        agents.push({
          id: `Agent[${i + 0.5}, ${j + 0.5}]`,
          row: i,
          col: j,
        })
      }
    }
    return agents
  }

  getAgentPrompt(agent: any, initialPlan: any): string {
    const { row, col } = agent
    const statePrompt = this.getStatePrompt()

    return `
You're an artifact-moving agent in a multi-agent system, stationed on a 1x1 square in a grid playground. You can only interact with objects located on the corners of your square. Squares are denoted by their center coordinates (e.g., square[0.5, 0.5]), and actions involve moving artifacts to targets or other three corners, represented by colors (e.g., move(artifact_red, target_red)). Each square can contain many targets.

A central planner coordinates all agents to achieve the goal: match each artifact with its color-coded target.

The current state and possible actions are:
${statePrompt}

The initial plan is: ${JSON.stringify(initialPlan)}

Think step-by-step about the task and initial plan. Carefully check and correct if there are mistakes.
[Remember that each corner can only contain at most one artifact! Avoid collisions.]

End your response by either: 1) output PROCEED, if the plans require further discussion; 2) If everyone has made proposals and got approved, output the final plan as soon as possible, must strictly follow [Action Output Instruction]!

[Action Output Instruction]
Must first output 'EXECUTE', then on the new line specify your action plan in this format: {"Agent[0.5, 0.5]":"move(artifact_blue, position[0.0, 2.0])", "Agent[1.5, 0.5]":"move..."}.

Your response:
    `.trim()
  }

  getAgentFeedbackPrompt(agent: any, centralPlan: any): string {
    const statePrompt = this.getStatePrompt()

    return `
You're an artifact-moving agent in a multi-agent system. A central planner coordinates all agents to achieve the goal: match each artifact with its color-coded target.

The current state and possible actions are:
${statePrompt}

The central planner's current action plan is: ${JSON.stringify(centralPlan)}.

[Remember that each corner can only contain at most one artifact! Avoid collisions.] Please check the given plan, especially avoiding the artifact you are moving will collide with other artifacts in the corner. Avoid the case that two artifacts move to the same corner at the same step. If you agree with it, respond 'I Agree', without any extra words. If not, briefly explain your objections to the central planner. Your response:
    `.trim()
  }

  getDistributedAgentPrompt(agent: any, dialogue: string): string {
    const statePrompt = this.getStatePrompt()

    return `
You're an artifact-moving agent in a multi-agent system, stationed on a 1x1 square in a grid playground. You can only interact with objects located on the corners of your square. All agents coordinate together to achieve the goal: match each artifact with its color-coded target.

The current state and possible actions are:
${statePrompt}

The previous dialogue history is: ${dialogue}

Think step-by-step about the task and the previous dialogue history. Carefully check and correct them if they made a mistake.
Respond very concisely but informatively, and do not repeat what others have said. Discuss with others to come up with the best plan.
Propose exactly one action for yourself at the current round.

End your response by either: 1) output PROCEED, if the plans require further discussion; 2) If everyone has made proposals and got approved, output the final plan as soon as possible, must strictly follow [Action Output Instruction]!

[Action Output Instruction]
Must first output 'EXECUTE', then on the new line specify your action plan in this format: {"Agent[0.5, 0.5]":"move(artifact_blue, position[0.0, 2.0])", "Agent[1.5, 0.5]":"move..."}.

Your response:
    `.trim()
  }

  applyActions(actions: any): { collision: boolean } {
    if (!actions || typeof actions !== "object") {
      console.log("No actions provided or invalid actions format")
      return { collision: false }
    }

    const moves: Array<{ from: string; to: string; artifact: string }> = []

    // Parse and validate actions
    for (const [agentKey, actionStr] of Object.entries(actions)) {
      if (typeof actionStr !== "string") {
        console.warn("Invalid action format for agent:", agentKey, actionStr)
        continue
      }

      // Fix the regex pattern - use parentheses instead of dollar signs
      const match = actionStr.match(/move$$(.*?),\s*(.*?)$$/)
      if (!match) {
        console.warn("Could not parse action:", actionStr)
        continue
      }

      const [, artifact, destination] = match

      // Find artifact location
      let fromPos = ""
      for (const [pos, items] of Object.entries(this.grid)) {
        if (items.includes(artifact)) {
          fromPos = pos
          break
        }
      }

      if (!fromPos) {
        console.warn("Artifact not found:", artifact)
        continue
      }

      let toPos = ""
      if (destination.startsWith("position[")) {
        const coords = destination.match(/position\[(.*?),\s*(.*?)\]/)
        if (coords) {
          toPos = `${coords[1]}_${coords[2]}`
        }
      } else if (destination.startsWith("target_")) {
        // Find target position
        for (const [pos, items] of Object.entries(this.grid)) {
          if (items.includes(destination)) {
            toPos = pos
            break
          }
        }
      }

      if (toPos) {
        moves.push({ from: fromPos, to: toPos, artifact })
      } else {
        console.warn("Could not determine destination for:", destination)
      }
    }

    // Check for collisions
    const destinations = new Set()
    for (const move of moves) {
      if (destinations.has(move.to)) {
        console.log("Collision detected: multiple artifacts moving to", move.to)
        return { collision: true }
      }
      destinations.add(move.to)

      if (this.grid[move.to].length > 0 && !this.grid[move.to].includes(`target_${move.artifact.split("_")[1]}`)) {
        console.log("Collision detected: destination occupied", move.to)
        return { collision: true }
      }
    }

    // Apply moves
    for (const move of moves) {
      const artifactIndex = this.grid[move.from].indexOf(move.artifact)
      if (artifactIndex !== -1) {
        this.grid[move.from].splice(artifactIndex, 1)

        // Check if moving to target
        const color = move.artifact.split("_")[1]
        const targetIndex = this.grid[move.to].indexOf(`target_${color}`)
        if (targetIndex !== -1) {
          // Remove both artifact and target (matched)
          this.grid[move.to].splice(targetIndex, 1)
          console.log(`Matched ${move.artifact} with target_${color}`)
        } else {
          // Just move artifact
          this.grid[move.to].push(move.artifact)
          console.log(`Moved ${move.artifact} to ${move.to}`)
        }
      }
    }

    return { collision: false }
  }

  isCompleted(): boolean {
    // Check if all artifacts have been matched with targets
    for (const items of Object.values(this.grid)) {
      for (const item of items) {
        if (item.startsWith("artifact_") || item.startsWith("target_")) {
          return false
        }
      }
    }
    return true
  }
}
