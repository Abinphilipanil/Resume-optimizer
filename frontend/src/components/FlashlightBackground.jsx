import { memo, useMemo } from "react"

function FlashlightBackground({ spotlightTarget }) {
  const style = useMemo(() => {
    const x = typeof spotlightTarget?.x === "number" ? spotlightTarget.x : 50
    const y = typeof spotlightTarget?.y === "number" ? spotlightTarget.y : 20

    return {
      "--spot-x": `${x}%`,
      "--spot-y": `${y}%`,
    }
  }, [spotlightTarget?.x, spotlightTarget?.y])

  return (
    <div className="flashlight-container tracking" style={style}>
      <div className="flashlight-inner"></div>
    </div>
  )
}

export default memo(FlashlightBackground)
