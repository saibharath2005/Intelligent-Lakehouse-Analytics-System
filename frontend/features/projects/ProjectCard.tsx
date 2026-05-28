import { Database, Layers, LayoutDashboard, Trash2 } from "lucide-react"
import Link from "next/link"

export default function ProjectCard({ project }: any) {

  return (

    <Link href={`/project/${project.id}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
          <Layers size={20} />
        </div>
        <button className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 size={16} />
        </button>
      </div>
      <h3 className="font-bold text-slate-900">{project.name}</h3>
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Database size={14} />
          <span>{project.dataset_count} Datasets</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <LayoutDashboard size={14} />
          <span>{project.dashboard_count} Dashboards</span>
        </div>
      </div>
    </Link>

  )
}

