"use client"

import Sidebar from "./Sidebar"

export default function AppShell({children}:any){

  return (

    <div className="flex min-h-screen">

      <Sidebar/>

      <main className="flex-1 p-6 bg-gray-50">

        {children}

      </main>

    </div>

  )
}