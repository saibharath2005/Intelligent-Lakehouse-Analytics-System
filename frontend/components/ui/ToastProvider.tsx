"use client"

import { createContext, JSX, useContext, useState } from "react"
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react"

type ToastType = "success" | "error" | "info" | "warning"

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const ToastContext = createContext<any>(null)

export function ToastProvider({ children }: any) {

  const [toasts, setToasts] = useState<ToastItem[]>([])

  function remove(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function show(message: string, type: ToastType) {

    const id = Date.now()

    setToasts(prev => [...prev, { id, message, type }])

    setTimeout(() => remove(id), 4000)
  }

  const toast = {
    success: (msg: string) => show(msg, "success"),
    error: (msg: string) => show(msg, "error"),
    info: (msg: string) => show(msg, "info"),
    warning: (msg: string) => show(msg, "warning")
  }

  return (
    <ToastContext.Provider value={toast}>

      {children}

      <div className="fixed top-6 right-6 z-50 space-y-3">

        {toasts.map(t => (
          <Toast key={t.id} toast={t} remove={remove} />
        ))}

      </div>

    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function Toast({
  toast,
  remove,
}: {
  toast: ToastItem
  remove: (id: number) => void
}) {

  const icon: Record<ToastType, JSX.Element> = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
    warning: <AlertTriangle size={18} />,
  }

  const colors: Record<ToastType, string> = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    warning: "bg-yellow-500",
  }

  return (
    <div
      className={`flex items-center gap-3 text-white px-4 py-3 rounded-xl shadow-lg animate-slide-in ${colors[toast.type]}`}
    >
      {icon[toast.type]}

      <span className="text-sm font-medium">
        {toast.message}
      </span>

      <button
        onClick={() => remove(toast.id)}
        className="ml-auto"
      >
        <X size={16} />
      </button>
    </div>
  )
}