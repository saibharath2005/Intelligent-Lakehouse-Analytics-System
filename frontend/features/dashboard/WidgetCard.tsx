"use client"

import React, { useMemo, useCallback, CSSProperties } from "react"
import ChartRenderer from "./ChartRenderer"


const ROW_H = 100

const WidgetCard = React.memo(function WidgetCard({ w, cw, dark, accent }: any) {

  // 🚀 MEMOIZED STYLE (IMPORTANT)
  const style: CSSProperties = useMemo(() => ({
    position: "absolute",
    left: w.layout.x * cw,
    top: w.layout.y * ROW_H,
    width: w.layout.w * cw,
    height: w.layout.h * ROW_H,
    border: "1px solid #ccc",
    borderRadius: 10,
    overflow: "hidden",
  }), [w.layout, cw])

  return (
    <div style={style}>
      <ChartRenderer w={w} dark={dark} accent={accent} cw={cw} />
    </div>
  )
})

export default WidgetCard