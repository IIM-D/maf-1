"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileCheck, AlertCircle } from "lucide-react"

interface ModelUploaderProps {
  onModelUploaded: (modelUrl: string) => void
}

export function ModelUploader({ onModelUploaded }: ModelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const glbFile = files.find((file) => file.name.toLowerCase().endsWith(".glb"))

    if (glbFile) {
      handleFileUpload(glbFile)
    } else {
      setErrorMessage("请上传GLB格式的3D模型文件")
      setUploadStatus("error")
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [])

  const handleFileUpload = async (file: File) => {
    setUploadStatus("uploading")
    setErrorMessage("")

    try {
      // 方法1: 使用FileReader创建本地URL
      const reader = new FileReader()
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" })
        const url = URL.createObjectURL(blob)

        setUploadedFile(file.name)
        setUploadStatus("success")
        onModelUploaded(url)
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error("文件上传失败:", error)
      setErrorMessage("文件上传失败，请重试")
      setUploadStatus("error")
    }
  }

  const uploadToPublicFolder = async (file: File) => {
    try {
      // 方法2: 上传到public文件夹（需要后端支持）
      const formData = new FormData()
      formData.append("model", file)

      const response = await fetch("/api/upload-model", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("上传失败")
      }

      const result = await response.json()
      return result.url
    } catch (error) {
      console.error("上传到服务器失败:", error)
      throw error
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          3D模型上传
        </CardTitle>
        <CardDescription>上传您的"电池组装线.glb"文件以替换默认的3D场景</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 拖拽上传区域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : uploadStatus === "success"
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-gray-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploadStatus === "uploading" ? (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-600">正在上传...</p>
            </div>
          ) : uploadStatus === "success" ? (
            <div className="space-y-2">
              <FileCheck className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-sm font-medium text-green-700">上传成功!</p>
              <p className="text-xs text-gray-600">{uploadedFile}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-12 h-12 text-gray-400 mx-auto" />
              <div>
                <p className="text-lg font-medium">拖拽GLB文件到此处</p>
                <p className="text-sm text-gray-600">或点击下方按钮选择文件</p>
              </div>
              <input type="file" accept=".glb" onChange={handleFileSelect} className="hidden" id="model-upload" />
              <Button asChild variant="outline">
                <label htmlFor="model-upload" className="cursor-pointer">
                  选择文件
                </label>
              </Button>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {uploadStatus === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* 上传方式说明 */}
        <div className="space-y-4 text-sm">
          <h4 className="font-medium">推荐的上传方式:</h4>

          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-blue-800">方式1: 直接拖拽上传 (推荐)</h5>
              <p className="text-blue-700">将GLB文件直接拖拽到上方区域，系统会自动处理</p>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <h5 className="font-medium text-green-800">方式2: 放置到public文件夹</h5>
              <p className="text-green-700">
                将"电池组装线.glb"文件放到项目的 <code className="bg-white px-1 rounded">public/models/</code> 文件夹中
              </p>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <h5 className="font-medium text-purple-800">方式3: 使用CDN链接</h5>
              <p className="text-purple-700">上传到云存储服务(如阿里云OSS、腾讯云COS)，然后使用HTTPS链接</p>
            </div>
          </div>
        </div>

        {/* 文件要求 */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div>
                <strong>文件要求:</strong>
              </div>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>文件格式: GLB (推荐) 或 GLTF</li>
                <li>文件大小: 建议小于50MB</li>
                <li>纹理: 建议嵌入到GLB文件中</li>
                <li>坐标系: 建议使用右手坐标系</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
