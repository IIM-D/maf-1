"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Play, Square, BarChart3, Factory, Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ProductionLineVisualization } from "@/components/production-line-visualization"

interface ExperimentConfig {
  framework: "DMAS" | "HMAS-1" | "CMAS" | "HMAS-2"
  dialogueHistory: "_wo_any_dialogue_history" | "_w_only_state_action_history" | "_w_all_dialogue_history"
  gridSize: "2x2" | "2x4" | "4x4" | "4x8"
  iterations: number
}

interface ExperimentResult {
  id: string
  config: ExperimentConfig
  status: "running" | "completed" | "failed"
  progress: number
  results?: {
    successRate: number
    avgActionTime: number
    avgTokenUsage: number
    apiQueries: number
  }
}

interface OllamaConnectionStatus {
  id: string
  name: string
  connected: boolean
  model: string
  baseUrl: string
  error?: string
  responseTime?: number
}

export default function MultiAgentFramework() {
  const [experiments, setExperiments] = useState<ExperimentResult[]>([])
  const [currentConfig, setCurrentConfig] = useState<ExperimentConfig>({
    framework: "HMAS-2",
    dialogueHistory: "_w_only_state_action_history",
    gridSize: "2x2",
    iterations: 10,
  })
  const [isRunning, setIsRunning] = useState(false)
  const [currentEnvironment, setCurrentEnvironment] = useState<any>(null)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaConnectionStatus[]>([])
  const [isCheckingConnections, setIsCheckingConnections] = useState(false)
  const [runningExperimentId, setRunningExperimentId] = useState<string | null>(null)

  useEffect(() => {
    checkOllamaConnections()
  }, [])

  const checkOllamaConnections = async () => {
    setIsCheckingConnections(true)
    try {
      const response = await fetch("/api/ollama/status")
      if (response.ok) {
        const status = await response.json()
        setOllamaStatus(status)
        console.log("Ollama connection status:", status)
      }
    } catch (error) {
      console.error("Failed to check Ollama connections:", error)
    } finally {
      setIsCheckingConnections(false)
    }
  }

  const startExperiment = async () => {
    const disconnectedInstances = ollamaStatus.filter((s) => !s.connected)
    if (disconnectedInstances.length > 0) {
      alert(`警告: 部分LLM智能体未连接: ${disconnectedInstances.map((s) => s.name).join(", ")}。实验可能无法正常运行。`)
    }

    setIsRunning(true)
    const experimentId = Date.now().toString()
    setRunningExperimentId(experimentId)

    const newExperiment: ExperimentResult = {
      id: experimentId,
      config: { ...currentConfig },
      status: "running",
      progress: 0,
    }

    setExperiments((prev) => [newExperiment, ...prev])

    try {
      const response = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: currentConfig, experimentId }),
      })

      if (!response.ok) throw new Error("Failed to start experiment")

      const progressInterval = setInterval(() => {
        setExperiments((prev) =>
          prev.map((exp) => (exp.id === experimentId ? { ...exp, progress: Math.min(exp.progress + 10, 90) } : exp)),
        )
      }, 2000)

      const result = await response.json()

      clearInterval(progressInterval)

      setExperiments((prev) =>
        prev.map((exp) =>
          exp.id === experimentId ? { ...exp, status: "completed", progress: 100, results: result.results } : exp,
        ),
      )
    } catch (error) {
      setExperiments((prev) =>
        prev.map((exp) => (exp.id === experimentId ? { ...exp, status: "failed", progress: 0 } : exp)),
      )
    } finally {
      setIsRunning(false)
      setRunningExperimentId(null)
    }
  }

  const stopExperiment = async (experimentId: string) => {
    try {
      await fetch(`/api/experiments/${experimentId}`, { method: "DELETE" })
      setExperiments((prev) =>
        prev.map((exp) => (exp.id === experimentId ? { ...exp, status: "failed", progress: 0 } : exp)),
      )
      if (experimentId === runningExperimentId) {
        setRunningExperimentId(null)
      }
    } catch (error) {
      console.error("Failed to stop experiment:", error)
    }
  }

  const getGridDimensions = (gridSize: string) => {
    const [rows, cols] = gridSize.split("x").map(Number)
    return { rows, cols }
  }

  const getConnectionStatusIcon = (status: OllamaConnectionStatus) => {
    if (status.connected) {
      return <Wifi className="w-4 h-4 text-green-500" />
    } else {
      return <WifiOff className="w-4 h-4 text-red-500" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">多智能体LLM框架</h1>
          <p className="text-lg text-gray-600">电池组装生产线协作机器人智能协调系统</p>
        </div>

        {/* Production Line Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5" />
              电池组装生产线仿真
            </CardTitle>
            <CardDescription>基于工位91的3D生产线环境，支持多智能体电池电芯操作的实时仿真</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductionLineVisualization
              rows={getGridDimensions(currentConfig.gridSize).rows}
              cols={getGridDimensions(currentConfig.gridSize).cols}
              environment={currentEnvironment}
              onEnvironmentChange={setCurrentEnvironment}
              isExperimentRunning={isRunning}
              experimentId={runningExperimentId}
            />
          </CardContent>
        </Card>

        <Tabs defaultValue="experiment" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="experiment">实验设置</TabsTrigger>
            <TabsTrigger value="results">实验结果</TabsTrigger>
            <TabsTrigger value="analytics">性能分析</TabsTrigger>
          </TabsList>

          <TabsContent value="experiment" className="space-y-6">
            {/* Configuration Panel */}
            <Card>
              <CardHeader>
                <CardTitle>实验配置</CardTitle>
                <CardDescription>配置多智能体框架参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">框架类型</label>
                    <Select
                      value={currentConfig.framework}
                      onValueChange={(value: any) => setCurrentConfig((prev) => ({ ...prev, framework: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DMAS">DMAS</SelectItem>
                        <SelectItem value="HMAS-1">HMAS-1</SelectItem>
                        <SelectItem value="CMAS">CMAS</SelectItem>
                        <SelectItem value="HMAS-2">HMAS-2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">对话历史</label>
                    <Select
                      value={currentConfig.dialogueHistory}
                      onValueChange={(value: any) => setCurrentConfig((prev) => ({ ...prev, dialogueHistory: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_wo_any_dialogue_history">无历史</SelectItem>
                        <SelectItem value="_w_only_state_action_history">仅状态-动作</SelectItem>
                        <SelectItem value="_w_all_dialogue_history">完整历史</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">工位布局</label>
                    <Select
                      value={currentConfig.gridSize}
                      onValueChange={(value: any) => setCurrentConfig((prev) => ({ ...prev, gridSize: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2x2">2×2</SelectItem>
                        <SelectItem value="2x4">2×4</SelectItem>
                        <SelectItem value="4x4">4×4</SelectItem>
                        <SelectItem value="4x8">4×8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">迭代次数</label>
                    <Select
                      value={currentConfig.iterations.toString()}
                      onValueChange={(value) =>
                        setCurrentConfig((prev) => ({ ...prev, iterations: Number.parseInt(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={startExperiment} disabled={isRunning} className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    开始实验
                  </Button>
                  <Button
                    onClick={checkOllamaConnections}
                    variant="outline"
                    disabled={isCheckingConnections}
                    className="flex items-center gap-2"
                  >
                    <Wifi className="w-4 h-4" />
                    {isCheckingConnections ? "检查中..." : "检查连接"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Agent Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>LLM智能体配置</CardTitle>
                <CardDescription>中央协调器使用DeepSeek-V3-0324，本地LLM智能体可驱动多个机械臂</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">中央协调智能体</h3>
                    <div className="space-y-2">
                      <Badge variant="secondary">DeepSeek-V3-0324</Badge>
                      <p className="text-sm text-gray-600">负责CMAS、HMAS-1和HMAS-2架构的高级规划和协调</p>
                      <div className="text-xs text-gray-500">端点: DeepSeek API</div>
                    </div>
                  </div>

                  {ollamaStatus.map((status, index) => (
                    <div key={status.id} className="space-y-4">
                      <h3 className="font-semibold text-lg">{status.name}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{status.model}</Badge>
                          {getConnectionStatusIcon(status)}
                          {status.responseTime && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {status.responseTime}ms
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">本地决策LLM智能体，可驱动一个或多个机械臂</p>
                        <div className="text-xs text-gray-500">端点: {status.baseUrl}</div>
                        {status.error && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {status.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Connection Status Alert */}
                {ollamaStatus.length > 0 && ollamaStatus.some((s) => !s.connected) && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div>部分LLM智能体未连接，请检查以下项目：</div>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>确保目标设备上Ollama服务正在运行</li>
                          <li>检查Ollama是否绑定到0.0.0.0:11434（而非仅localhost）</li>
                          <li>验证防火墙设置允许端口11434</li>
                          <li>确认设备间网络连接正常</li>
                        </ul>
                        <div className="text-xs text-gray-600 mt-2">
                          提示: 在目标设备上运行{" "}
                          <code className="bg-gray-100 px-1 rounded">ollama serve --host 0.0.0.0</code>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">实验结果</h2>

              {experiments.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>尚未运行任何实验。配置并启动实验以查看结果。</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {experiments.map((experiment) => (
                    <Card key={experiment.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {experiment.config.framework} - {experiment.config.gridSize}
                            </CardTitle>
                            <CardDescription>
                              {experiment.config.dialogueHistory.replace(/_/g, " ")} • {experiment.config.iterations}{" "}
                              次迭代
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                experiment.status === "completed"
                                  ? "default"
                                  : experiment.status === "running"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {experiment.status === "running"
                                ? "运行中"
                                : experiment.status === "completed"
                                  ? "已完成"
                                  : "失败"}
                            </Badge>
                            {experiment.status === "running" && (
                              <Button size="sm" variant="outline" onClick={() => stopExperiment(experiment.id)}>
                                <Square className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {experiment.status === "running" && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>进度</span>
                              <span>{experiment.progress}%</span>
                            </div>
                            <Progress value={experiment.progress} />
                          </div>
                        )}

                        {experiment.results && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <div className="text-2xl font-bold text-green-700">
                                {(experiment.results.successRate * 100).toFixed(1)}%
                              </div>
                              <div className="text-sm text-green-600">成功率</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <div className="text-2xl font-bold text-blue-700">
                                {experiment.results.avgActionTime.toFixed(1)}
                              </div>
                              <div className="text-sm text-blue-600">平均动作时间</div>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                              <div className="text-2xl font-bold text-purple-700">
                                {experiment.results.avgTokenUsage.toLocaleString()}
                              </div>
                              <div className="text-sm text-purple-600">Token使用量</div>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded-lg">
                              <div className="text-2xl font-bold text-orange-700">{experiment.results.apiQueries}</div>
                              <div className="text-sm text-orange-600">API查询次数</div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  性能分析
                </CardTitle>
                <CardDescription>不同框架和配置的对比分析</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>运行实验后将在此显示分析结果</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
