import { type NextRequest, NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("model") as File

    if (!file) {
      return NextResponse.json({ error: "没有找到文件" }, { status: 400 })
    }

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json({ error: "只支持GLB格式文件" }, { status: 400 })
    }

    // 验证文件大小 (50MB限制)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小不能超过50MB" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 确保models目录存在
    const modelsDir = path.join(process.cwd(), "public", "models")

    try {
      await writeFile(path.join(modelsDir, "battery-assembly-line.glb"), buffer)
    } catch (error) {
      // 如果目录不存在，创建目录
      const fs = require("fs")
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }
      await writeFile(path.join(modelsDir, "battery-assembly-line.glb"), buffer)
    }

    return NextResponse.json({
      success: true,
      url: "/models/battery-assembly-line.glb",
      message: "模型上传成功",
    })
  } catch (error) {
    console.error("模型上传失败:", error)
    return NextResponse.json({ error: "模型上传失败" }, { status: 500 })
  }
}
