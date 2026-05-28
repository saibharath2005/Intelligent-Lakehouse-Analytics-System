import {
  LayoutDashboard,
  Folder,
  Database,
  Bot,
  Settings,
  Users,
} from "lucide-react"

// Global nav — only things that aren't project-specific
export const globalLinks = [
  {
    name: "Projects",
    href: "/projects",
    icon: Folder,
  },
]

// Project-level nav — shown when inside /project/[id]/*
export const projectLinks = [
  {
    name: "Datasets",
    path: "datasets",
    icon: Database,
  },
  {
    name: "Dashboards",
    path: "dashboards",
    icon: LayoutDashboard,
  },
  {
    name: "AI Chat",
    path: "ai",
    icon: Bot,
  },
  {
    name: "Members",
    path: "members",
    icon: Users,
  },
  {
    name: "Settings",
    path: "settings",
    icon: Settings,
  },
]
