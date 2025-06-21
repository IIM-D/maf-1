import { LLMService } from "./llm-service"
import { OllamaService } from "./ollama-service"
import { EnvironmentService } from "./environment-service"

interface ExperimentConfig {
  framework: "DMAS" | "HMAS-1" | "CMAS" | "HMAS-2"
  dialogueHistory: string
  gridSize: string
  iterations: number
}

export async function runExperiment(config: ExperimentConfig, experimentId: string) {
  const llmService = new LLMService()
  const ollamaService = new OllamaService()
  const environmentService = new EnvironmentService()

  const [rows, cols] = config.gridSize.split("x").map(Number)

  let successCount = 0
  let totalActionTime = 0
  let totalTokenUsage = 0
  let totalApiQueries = 0

  // Check Ollama connections before starting
  const connectionStatus = await ollamaService.checkOllamaConnections()
  console.log("LLM Agent connection status:", connectionStatus)

  // Log any connection issues
  const disconnectedAgents = connectionStatus.filter((s) => !s.connected)
  if (disconnectedAgents.length > 0) {
    console.warn(
      "⚠️ Some LLM agents are disconnected:",
      disconnectedAgents.map((s) => s.name),
    )
  }

  for (let iteration = 0; iteration < config.iterations; iteration++) {
    try {
      // Create environment
      const environment = environmentService.createEnvironment(rows, cols)

      // Run single experiment iteration
      const result = await runSingleIteration(config, environment, llmService, ollamaService, iteration)

      if (result.success) {
        successCount++
      }

      totalActionTime += result.actionTime
      totalTokenUsage += result.tokenUsage
      totalApiQueries += result.apiQueries
    } catch (error) {
      console.error(`Iteration ${iteration} failed:`, error)
    }
  }

  return {
    successRate: successCount / config.iterations,
    avgActionTime: totalActionTime / config.iterations,
    avgTokenUsage: totalTokenUsage / config.iterations,
    apiQueries: totalApiQueries,
  }
}

async function runSingleIteration(
  config: ExperimentConfig,
  environment: any,
  llmService: LLMService,
  ollamaService: OllamaService,
  iteration: number,
) {
  const startTime = Date.now()
  let tokenUsage = 0
  let apiQueries = 0
  let success = false

  const maxSteps = config.gridSize === "4x8" ? 40 : 30

  try {
    for (let step = 0; step < maxSteps; step++) {
      console.log(`Step ${step + 1}/${maxSteps} for iteration ${iteration}`)

      const statePrompt = environment.getStatePrompt()
      let response: any

      switch (config.framework) {
        case "CMAS":
          // Central coordinator only (DeepSeek-V3-0324)
          response = await llmService.getCentralCoordinatorResponse(statePrompt, config)
          tokenUsage += response.tokenUsage
          apiQueries++

          // Check for API errors
          if (response.error) {
            console.error("Central coordinator error:", response.rawResponse)
            return {
              success: false,
              actionTime: Date.now() - startTime,
              tokenUsage,
              apiQueries,
              error: "Central coordinator API error",
            }
          }
          break

        case "HMAS-1":
          // Central coordinator + local LLM agents with initial planning
          const initialPlan = await llmService.getCentralCoordinatorResponse(statePrompt, config)
          tokenUsage += initialPlan.tokenUsage
          apiQueries++

          if (initialPlan.error) {
            console.error("Initial plan error:", initialPlan.rawResponse)
            return {
              success: false,
              actionTime: Date.now() - startTime,
              tokenUsage,
              apiQueries,
              error: "Initial planning error",
            }
          }

          response = await runHMAS1Dialogue(initialPlan, environment, ollamaService, config)
          tokenUsage += response.tokenUsage
          apiQueries += response.apiQueries
          break

        case "HMAS-2":
          // Central coordinator + local LLM agents with feedback
          const centralPlan = await llmService.getCentralCoordinatorResponse(statePrompt, config)
          tokenUsage += centralPlan.tokenUsage
          apiQueries++

          if (centralPlan.error) {
            console.error("Central plan error:", centralPlan.rawResponse)
            return {
              success: false,
              actionTime: Date.now() - startTime,
              tokenUsage,
              apiQueries,
              error: "Central planning error",
            }
          }

          response = await runHMAS2Feedback(centralPlan, environment, ollamaService, config)
          tokenUsage += response.tokenUsage
          apiQueries += response.apiQueries
          break

        case "DMAS":
          // Distributed LLM agents only (both Ollama instances)
          response = await runDMASDialogue(environment, ollamaService, config)
          tokenUsage += response.tokenUsage
          apiQueries += response.apiQueries
          break
      }

      // Validate response
      if (!response || !response.actions) {
        console.warn("No valid actions received, using empty action set")
        response = { actions: {} }
      }

      // Apply actions to environment
      const actionResult = environment.applyActions(response.actions)

      if (actionResult.collision) {
        console.log("Collision detected, ending iteration")
        break // Collision detected
      }

      if (environment.isCompleted()) {
        console.log("Environment completed successfully!")
        success = true
        break
      }
    }
  } catch (error) {
    console.error("Error in iteration:", error)
    return {
      success: false,
      actionTime: Date.now() - startTime,
      tokenUsage,
      apiQueries,
      error: error.message,
    }
  }

  const actionTime = Date.now() - startTime

  return {
    success,
    actionTime,
    tokenUsage,
    apiQueries,
  }
}

async function runHMAS1Dialogue(initialPlan: any, environment: any, ollamaService: OllamaService, config: any) {
  // Implementation for HMAS-1 dialogue between local LLM agents
  let tokenUsage = 0
  let apiQueries = 0

  const agents = environment.getAgents()
  let finalPlan = initialPlan.plan

  for (let round = 0; round < 3; round++) {
    for (const agent of agents) {
      const agentPrompt = environment.getAgentPrompt(agent, initialPlan.plan)
      // Pass agent ID to select appropriate LLM agent
      const response = await ollamaService.getLocalAgentResponse(agentPrompt, config, agent.id)

      tokenUsage += response.tokenUsage
      apiQueries++

      console.log(`Agent ${agent.id} response from ${response.instanceName} (${response.model})`)

      if (response.hasExecuteCommand) {
        finalPlan = response.plan
        break
      }
    }

    if (finalPlan !== initialPlan.plan) break
  }

  return {
    actions: finalPlan,
    tokenUsage,
    apiQueries,
  }
}

async function runHMAS2Feedback(centralPlan: any, environment: any, ollamaService: OllamaService, config: any) {
  // Implementation for HMAS-2 feedback mechanism with different LLM agents
  let tokenUsage = 0
  let apiQueries = 0

  const agents = environment.getAgents()
  let feedback = ""

  for (const agent of agents) {
    const agentPrompt = environment.getAgentFeedbackPrompt(agent, centralPlan.plan)
    // Pass agent ID to select appropriate LLM agent
    const response = await ollamaService.getLocalAgentResponse(agentPrompt, config, agent.id)

    tokenUsage += response.tokenUsage
    apiQueries++

    console.log(`Agent ${agent.id} feedback from ${response.instanceName} (${response.model})`)

    if (!response.agrees) {
      feedback += `[${response.instanceName}]: ${response.feedback}\n`
    }
  }

  return {
    actions: centralPlan.plan,
    tokenUsage,
    apiQueries,
    feedback,
  }
}

async function runDMASDialogue(environment: any, ollamaService: OllamaService, config: any) {
  // Implementation for DMAS distributed dialogue between different LLM agents
  let tokenUsage = 0
  let apiQueries = 0

  const agents = environment.getAgents()
  let dialogue = ""
  let finalPlan = {}

  for (let round = 0; round < 3; round++) {
    for (const agent of agents) {
      const agentPrompt = environment.getDistributedAgentPrompt(agent, dialogue)
      // Pass agent ID to select appropriate LLM agent
      const response = await ollamaService.getLocalAgentResponse(agentPrompt, config, agent.id)

      tokenUsage += response.tokenUsage
      apiQueries++

      console.log(`Agent ${agent.id} dialogue from ${response.instanceName} (${response.model})`)

      dialogue += `[${agent.id}@${response.instanceName}]: ${response.message}\n`

      if (response.hasExecuteCommand) {
        finalPlan = response.plan
        break
      }
    }

    if (Object.keys(finalPlan).length > 0) break
  }

  return {
    actions: finalPlan,
    tokenUsage,
    apiQueries,
  }
}
