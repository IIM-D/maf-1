"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Environment, Html, useGLTF } from "@react-three/drei"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Play, Pause, Settings, Zap } from "lucide-react"
import * as THREE from "three"

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

interface RobotAction {
  robotId: string
  action: "move" | "pick" | "place" | "transfer"
  target?: string
  targetRobotId?: string
  position?: [number, number, number]
  duration: number
}

interface ProductionLineVisualizationProps {
  rows: number
  cols: number
  environment?: GridEnvironment
  onEnvironmentChange?: (env: GridEnvironment) => void
  isExperimentRunning?: boolean
  experimentId?: string
}

interface DeviceInfo {
  id: string
  type: "arm" | "cart" | "conveyor" | "workstation" | "unknown"
  originalObject: THREE.Object3D
  currentPosition: THREE.Vector3
  targetPosition?: THREE.Vector3
  isActive: boolean
  currentAction: RobotAction | null
  collaborationPartners: string[]
  displayObject?: THREE.Object3D
}

// 改进的设备检测函数
const detectAllDevicesInScene = (scene: THREE.Object3D): DeviceInfo[] => {
  const devices: DeviceInfo[] = []
  let deviceIndex = 0

  console.log("开始检测场景中的设备...")

  // 遍历场景中的所有对象
  scene.traverse((child) => {
    // 检测有意义的对象：Mesh或有子对象的Group
    if (child instanceof THREE.Mesh || (child instanceof THREE.Group && child.children.length > 0)) {
      // 排除场景根节点
      if (child === scene) return

      // 排除已经被检测为其他设备子对象的对象
      const isChildOfDetected = devices.some((device) => {
        let isChild = false
        device.originalObject.traverse((parent) => {
          if (parent === child) isChild = true
        })
        return isChild
      })

      if (isChildOfDetected) return

      const name = child.name.toLowerCase()
      const position = child.getWorldPosition(new THREE.Vector3())

      // 计算对象的包围盒来判断大小
      const box = new THREE.Box3().setFromObject(child)
      const size = box.getSize(new THREE.Vector3())
      const volume = size.x * size.y * size.z

      // 只处理有一定体积的对象（过滤掉太小的装饰性对象）
      if (volume > 0.1) {
        let type: DeviceInfo["type"] = "unknown"
        let id = ""

        // 基于名称的设备类型检测
        if (name.includes("arm") || name.includes("robot") || name.includes("manipulator")) {
          type = "arm"
          id = `机械臂_${deviceIndex++}`
        } else if (name.includes("cart") || name.includes("agv") || name.includes("vehicle") || name.includes("车")) {
          type = "cart"
          id = `运输车_${deviceIndex++}`
        } else if (
          name.includes("conveyor") ||
          name.includes("belt") ||
          name.includes("transport") ||
          name.includes("传送")
        ) {
          type = "conveyor"
          id = `传送带_${deviceIndex++}`
        } else if (
          name.includes("station") ||
          name.includes("cell") ||
          name.includes("work") ||
          name.includes("工位")
        ) {
          type = "workstation"
          id = `工作站_${deviceIndex++}`
        } else {
          // 基于结构和位置的智能分类
          if (child.children.length > 3) {
            type = "workstation"
            id = `设备组_${deviceIndex++}`
          } else if (size.y > size.x && size.y > size.z) {
            type = "arm"
            id = `立式设备_${deviceIndex++}`
          } else if (size.x > size.z * 2 || size.z > size.x * 2) {
            type = "conveyor"
            id = `长条设备_${deviceIndex++}`
          } else {
            type = "cart"
            id = `移动设备_${deviceIndex++}`
          }
        }

        devices.push({
          id,
          type,
          originalObject: child,
          currentPosition: position,
          isActive: false,
          currentAction: null,
          collaborationPartners: [],
        })

        console.log(
          `检测到设备: ${id} (${type}) - 位置: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)} - 体积: ${volume.toFixed(2)}`,
        )
      }
    }
  })

  console.log(`设备检测完成，共发现 ${devices.length} 个设备`)
  return devices
}

class SceneOptimizerAndController {
  private allDetectedDevices: DeviceInfo[] = []
  public selectedDevices: DeviceInfo[] = []
  private workstationLayout: { rows: number; cols: number } = { rows: 2, cols: 2 }
  private isRunning = false
  private actionsQueue: RobotAction[] = []

  loadInitialDevices(scene: THREE.Object3D) {
    console.log("加载初始设备...")
    this.allDetectedDevices = detectAllDevicesInScene(scene)
  }

  configureExperiment(rows: number, cols: number) {
    console.log(`配置实验: ${rows}x${cols} 工位布局`)
    this.workstationLayout = { rows, cols }
    this.selectAndRepositionDevices()
    this.generateCollaborationTasks()
  }

  private selectAndRepositionDevices() {
    const totalNeeded = this.workstationLayout.rows * this.workstationLayout.cols

    if (this.allDetectedDevices.length === 0) {
      console.warn("未检测到任何设备")
      this.selectedDevices = []
      return
    }

    // 按类型优先级选择设备
    const arms = this.allDetectedDevices.filter((d) => d.type === "arm")
    const workstations = this.allDetectedDevices.filter((d) => d.type === "workstation")
    const conveyors = this.allDetectedDevices.filter((d) => d.type === "conveyor")
    const carts = this.allDetectedDevices.filter((d) => d.type === "cart")
    const unknowns = this.allDetectedDevices.filter((d) => d.type === "unknown")

    const tempSelected: DeviceInfo[] = []
    tempSelected.push(...arms)
    tempSelected.push(...workstations)
    tempSelected.push(...conveyors)
    tempSelected.push(...carts)
    tempSelected.push(...unknowns)

    // 选择需要的设备数量
    this.selectedDevices = tempSelected.slice(0, totalNeeded).map((device, index) => ({
      ...device,
      displayObject: device.originalObject.clone(),
    }))

    // 重新定位选中的设备
    const spacing = 20 // 增加间距以便更好地观察
    const offsetX = ((this.workstationLayout.cols - 1) * spacing) / 2
    const offsetZ = ((this.workstationLayout.rows - 1) * spacing) / 2

    this.selectedDevices.forEach((device, index) => {
      const row = Math.floor(index / this.workstationLayout.cols)
      const col = index % this.workstationLayout.cols

      device.targetPosition = new THREE.Vector3(
        col * spacing - offsetX,
        0, // 统一放在地面上
        row * spacing - offsetZ,
      )

      device.currentPosition.copy(device.targetPosition)

      if (device.displayObject) {
        device.displayObject.position.copy(device.targetPosition)
        // 确保设备可见
        device.displayObject.visible = true
      }

      console.log(
        `设备 ${device.id} 重新定位到: (${device.targetPosition.x.toFixed(1)}, ${device.targetPosition.y.toFixed(1)}, ${device.targetPosition.z.toFixed(1)})`,
      )
    })

    console.log(`选择了 ${this.selectedDevices.length} 个设备进行协作`)
  }

  private generateCollaborationTasks() {
    this.actionsQueue = []
    if (this.selectedDevices.length < 2) return

    // 生成协作任务
    for (let i = 0; i < this.selectedDevices.length - 1; i += 2) {
      const device1 = this.selectedDevices[i]
      const device2 = this.selectedDevices[i + 1]
      if (!device1 || !device2) continue

      this.actionsQueue.push({ robotId: device1.id, action: "pick", duration: 3000, target: "工件" })
      this.actionsQueue.push({ robotId: device1.id, action: "transfer", targetRobotId: device2.id, duration: 4000 })
      this.actionsQueue.push({ robotId: device2.id, action: "place", duration: 3000, target: "装配位" })
    }

    console.log(`生成了 ${this.actionsQueue.length} 个协作任务`)
  }

  startSimulation() {
    console.log("开始仿真...")
    this.isRunning = true
    this.executeNextAction()
  }

  stopSimulation() {
    console.log("停止仿真...")
    this.isRunning = false
    this.actionsQueue = []
    this.selectedDevices.forEach((d) => (d.isActive = false))
  }

  private executeNextAction() {
    if (!this.isRunning || this.actionsQueue.length === 0) {
      this.isRunning = false
      return
    }

    const action = this.actionsQueue.shift()!
    const device = this.selectedDevices.find((d) => d.id === action.robotId)

    if (device && device.displayObject) {
      device.isActive = true
      device.currentAction = action
      console.log(`执行动作: ${device.id} - ${action.action}`)

      this.animateDeviceAction(device, action)

      setTimeout(() => {
        device.isActive = false
        device.currentAction = null
        this.executeNextAction()
      }, action.duration)
    } else {
      this.executeNextAction()
    }
  }

  private animateDeviceAction(device: DeviceInfo, action: RobotAction) {
    const obj = device.displayObject!
    const originalPos = obj.position.clone()
    const originalRot = obj.rotation.clone()

    switch (action.action) {
      case "pick":
        // 模拟抓取动作
        obj.position.y += 1
        setTimeout(() => obj.position.copy(originalPos), action.duration / 2)
        obj.rotation.y += Math.PI / 4
        setTimeout(() => obj.rotation.copy(originalRot), action.duration)
        break
      case "place":
        // 模拟放置动作
        obj.position.y -= 0.5
        setTimeout(() => obj.position.copy(originalPos), action.duration / 2)
        obj.rotation.y -= Math.PI / 4
        setTimeout(() => obj.rotation.copy(originalRot), action.duration)
        break
      case "transfer":
        if (action.targetRobotId) {
          const targetDevice = this.selectedDevices.find((d) => d.id === action.targetRobotId)
          if (targetDevice && targetDevice.displayObject) {
            const targetPos = targetDevice.displayObject.position.clone()
            const midPos = new THREE.Vector3().lerpVectors(originalPos, targetPos, 0.5)
            midPos.y += 2 // 抬高传递路径
            obj.position.copy(midPos)
            setTimeout(() => obj.position.copy(originalPos), action.duration)
          }
        }
        break
      case "move":
        if (action.position) {
          const targetPos = new THREE.Vector3(...action.position)
          obj.position.copy(targetPos)
          setTimeout(() => obj.position.copy(originalPos), action.duration)
        }
        break
    }
  }

  getDeviceDataForUI(): { id: string; type: string; isActive: boolean; action: string | null }[] {
    return this.selectedDevices.map((d) => ({
      id: d.id,
      type: d.type,
      isActive: d.isActive,
      action: d.currentAction ? d.currentAction.action : null,
    }))
  }

  getAllDetectedDevices() {
    return this.allDetectedDevices
  }
}

const globalController = new SceneOptimizerAndController()

// 3D场景内容组件
function ProductionLineScene({
  rows,
  cols,
  isRunning,
  onDevicesConfigured,
  onSceneLoaded,
}: {
  rows: number
  cols: number
  isRunning: boolean
  onDevicesConfigured: (devices: DeviceInfo[]) => void
  onSceneLoaded: (success: boolean, message: string) => void
}) {
  const { scene: loadedScene } = useGLTF("/models/battery-assembly-line.glb")
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null!)
  const originalSceneRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (loadedScene) {
      console.log("GLB场景加载成功")

      try {
        // 克隆原始场景
        const clonedScene = loadedScene.clone()

        // 计算场景边界并缩放
        const box = new THREE.Box3().setFromObject(clonedScene)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        if (maxDim > 0) {
          const targetSize = 50 // 目标大小
          const scale = targetSize / maxDim
          clonedScene.scale.setScalar(scale)
          console.log(`场景缩放倍数: ${scale.toFixed(2)}x`)
        }

        // 居中场景
        const center = box.getCenter(new THREE.Vector3())
        clonedScene.position.sub(center.multiplyScalar(clonedScene.scale.x))

        // 添加原始场景到显示组
        if (originalSceneRef.current) {
          originalSceneRef.current.clear()
          originalSceneRef.current.add(clonedScene)
        }

        // 检测设备
        globalController.loadInitialDevices(clonedScene)
        globalController.configureExperiment(rows, cols)
        onDevicesConfigured(globalController.selectedDevices)

        // 调整相机位置以更好地观察场景
        camera.position.set(30, 20, 30)
        camera.lookAt(0, 0, 0)

        onSceneLoaded(true, `场景加载成功，检测到 ${globalController.getAllDetectedDevices().length} 个设备`)
      } catch (error) {
        console.error("场景处理失败:", error)
        onSceneLoaded(false, `场景处理失败: ${error.message}`)
      }
    }
  }, [loadedScene, rows, cols, camera, onDevicesConfigured, onSceneLoaded])

  useEffect(() => {
    if (isRunning) {
      globalController.startSimulation()
    } else {
      globalController.stopSimulation()
    }
  }, [isRunning])

  return (
    <>
      {/* 原始场景显示 */}
      <group ref={originalSceneRef} />

      {/* 选中设备显示 */}
      <group ref={groupRef}>
        {globalController.selectedDevices.map((device) => (
          <group key={device.id} position={device.targetPosition?.toArray()}>
            {device.displayObject && <primitive object={device.displayObject} />}

            {/* 设备标签 */}
            <Html position={[0, 3, 0]}>
              <div
                className={`px-2 py-1 rounded text-xs font-bold shadow-lg border ${
                  device.isActive
                    ? "bg-green-500 text-white animate-pulse"
                    : device.type === "arm"
                      ? "bg-red-500 text-white"
                      : device.type === "cart"
                        ? "bg-blue-500 text-white"
                        : device.type === "conveyor"
                          ? "bg-yellow-500 text-white"
                          : "bg-gray-500 text-white"
                }`}
              >
                <div className="text-center">
                  <div>{device.id}</div>
                  {device.isActive && device.currentAction && (
                    <div className="text-xs mt-1">{device.currentAction.action}</div>
                  )}
                </div>
              </div>
            </Html>
          </group>
        ))}
      </group>
    </>
  )
}

// 状态监控组件
function StatusMonitor({
  devices,
  totalDetected,
}: {
  devices: { id: string; type: string; isActive: boolean; action: string | null }[]
  totalDetected: number
}) {
  return (
    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 space-y-3 min-w-80 shadow-lg border">
      <h4 className="font-bold text-lg text-gray-800 flex items-center gap-2">
        <Zap className="w-5 h-5 text-blue-600" />
        智能协作监控
      </h4>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-center p-2 bg-blue-50 rounded">
          <div className="text-xl font-bold text-blue-700">{totalDetected}</div>
          <div className="text-xs text-blue-600">检测设备</div>
        </div>
        <div className="text-center p-2 bg-green-50 rounded">
          <div className="text-xl font-bold text-green-700">{devices.length}</div>
          <div className="text-xs text-green-600">选中设备</div>
        </div>
      </div>

      <div className="border-t pt-3">
        <h5 className="font-medium text-sm mb-2">设备状态:</h5>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {devices.length === 0 ? (
            <p className="text-xs text-gray-500">无选中设备</p>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                <span className="font-mono text-xs">{device.id}</span>
                <Badge variant={device.isActive ? "default" : "secondary"} className="text-xs">
                  {device.isActive ? device.action || "工作中" : "待机"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function ProductionLineVisualization({
  rows,
  cols,
  environment,
  onEnvironmentChange,
  isExperimentRunning = false,
}: ProductionLineVisualizationProps) {
  const [isClient, setIsClient] = useState(false)
  const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>([])
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [uiDeviceList, setUiDeviceList] = useState<
    { id: string; type: string; isActive: boolean; action: string | null }[]
  >([])
  const [totalDetectedDevices, setTotalDetectedDevices] = useState(0)
  const [sceneLoadStatus, setSceneLoadStatus] = useState<{ loaded: boolean; message: string }>({
    loaded: false,
    message: "正在加载3D模型...",
  })

  useEffect(() => {
    setIsClient(true)
    // 自动添加初始化消息
    addSimulatedDialogue("central", "系统启动，正在加载电池组装生产线3D模型...")
  }, [])

  useEffect(() => {
    setIsSimulationRunning(isExperimentRunning)
  }, [isExperimentRunning])

  const handleSceneLoaded = (success: boolean, message: string) => {
    setSceneLoadStatus({ loaded: success, message })
    addSimulatedDialogue("central", message)
  }

  const handleDevicesConfigured = (devices: DeviceInfo[]) => {
    setUiDeviceList(
      devices.map((d) => ({
        id: d.id,
        type: d.type,
        isActive: d.isActive,
        action: d.currentAction ? d.currentAction.action : null,
      })),
    )
    setTotalDetectedDevices(globalController.getAllDetectedDevices().length)
    addSimulatedDialogue(
      "central",
      `工位布局配置完成 (${rows}×${cols})。选中 ${devices.length} 个设备进行协作，总检测到 ${globalController.getAllDetectedDevices().length} 个设备。`,
    )
  }

  // 定期更新UI设备列表
  useEffect(() => {
    const intervalId = setInterval(() => {
      setUiDeviceList(globalController.getDeviceDataForUI())
    }, 500)
    return () => clearInterval(intervalId)
  }, [])

  const toggleSimulation = () => {
    setIsSimulationRunning(!isSimulationRunning)
    if (!isSimulationRunning) {
      addSimulatedDialogue("central", `启动智能协作仿真，${uiDeviceList.length} 个设备开始协同工作...`)
    } else {
      addSimulatedDialogue("central", "协作仿真已暂停，设备回到待机状态。")
    }
  }

  const addSimulatedDialogue = (type: "central" | "local-alpha" | "local-beta", message: string) => {
    const agentNames = { central: "智能协调器", "local-alpha": "设备组Alpha", "local-beta": "设备组Beta" }
    setDialogueMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), timestamp: Date.now(), agent: agentNames[type], message, type },
    ])
  }

  const getAgentTypeColor = (type: string) => {
    switch (type) {
      case "central":
        return "text-purple-600 bg-purple-50"
      case "local-alpha":
        return "text-red-600 bg-red-50"
      case "local-beta":
        return "text-green-600 bg-green-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            电池组装生产线仿真: {rows}×{cols} 智能协作布局
            <Badge className="ml-2 bg-green-600 text-white">模型已集成</Badge>
          </h3>
          <p className="text-sm text-gray-600">
            基于真实生产线模型，智能选择并重新布局 {rows * cols} 个设备实现协作仿真
          </p>
          <div className="text-xs text-gray-500">状态: {sceneLoadStatus.message}</div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={toggleSimulation}
            variant={isSimulationRunning ? "destructive" : "default"}
            className="flex items-center gap-2"
            disabled={!sceneLoadStatus.loaded}
          >
            {isSimulationRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isSimulationRunning ? "暂停协作" : "启动协作"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
        <div className="text-center p-3 bg-white/70 rounded-lg shadow">
          <div className="text-3xl font-bold text-blue-700">{totalDetectedDevices}</div>
          <div className="text-sm text-blue-600">模型中总设备</div>
        </div>
        <div className="text-center p-3 bg-white/70 rounded-lg shadow">
          <div className="text-3xl font-bold text-green-700">{uiDeviceList.length}</div>
          <div className="text-sm text-green-600">选中协作设备</div>
        </div>
        <div className="text-center p-3 bg-white/70 rounded-lg shadow">
          <div className="text-3xl font-bold text-purple-700">{rows * cols}</div>
          <div className="text-sm text-purple-600">目标工位数</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 lg:order-1">
          {isClient && (
            <div className="h-[600px] lg:h-[700px] bg-gradient-to-br from-slate-100 to-blue-100 rounded-lg overflow-hidden relative border-2 border-slate-300 shadow-xl">
              <Canvas camera={{ position: [30, 20, 30], fov: 60 }} shadows>
                <Suspense
                  fallback={
                    <Html center className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-xl font-semibold text-slate-700">加载电池组装生产线...</p>
                      <p className="text-sm text-slate-500">正在解析3D模型并检测设备...</p>
                    </Html>
                  }
                >
                  <ProductionLineScene
                    rows={rows}
                    cols={cols}
                    isRunning={isSimulationRunning}
                    onDevicesConfigured={handleDevicesConfigured}
                    onSceneLoaded={handleSceneLoaded}
                  />
                  <Environment preset="warehouse" />
                  <ambientLight intensity={0.8} />
                  <directionalLight position={[20, 20, 10]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} />
                  <pointLight position={[-20, 10, -10]} intensity={1} />
                  <OrbitControls
                    minDistance={10}
                    maxDistance={200}
                    enablePan
                    enableZoom
                    zoomSpeed={1.5}
                    panSpeed={2}
                    rotateSpeed={1}
                  />
                  <gridHelper args={[100, 20, "#cccccc", "#e0e0e0"]} position={[0, 0, 0]} />
                  <axesHelper args={[15]} />
                </Suspense>

                <Html fullscreen style={{ pointerEvents: "none" }}>
                  <StatusMonitor devices={uiDeviceList} totalDetected={totalDetectedDevices} />
                </Html>
              </Canvas>
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 space-y-4 lg:order-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings className="w-6 h-6 text-blue-600" /> 系统状态
              </CardTitle>
              <CardDescription>生产线模型自动加载与设备智能识别</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <span>模型状态:</span>
                <Badge className={sceneLoadStatus.loaded ? "bg-green-600 text-white" : "bg-yellow-600 text-white"}>
                  {sceneLoadStatus.loaded ? "已加载" : "加载中"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                <span>设备检测:</span>
                <Badge className="bg-green-600 text-white">智能识别</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                <span>布局优化:</span>
                <Badge className="bg-purple-600 text-white">自动重排</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" /> 系统日志
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded">
              {dialogueMessages.map((msg) => (
                <div key={msg.id} className="p-2 rounded-md shadow-sm border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-xs font-medium ${getAgentTypeColor(msg.type)}`}>
                      {msg.agent}
                    </Badge>
                    <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm text-slate-700">{msg.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
