import { useCallback, useState, type FC } from "react"
import videoError from "./assets/video-error.svg"
import videoPlaceholder from "./assets/video-placeholder.svg"
import { frameLoop, frontalCamera, QRCanvas } from "./qr/dom"

const canvas = new QRCanvas({})

type QrCamera = Awaited<ReturnType<typeof frontalCamera>>

export const QrCamera: FC<{ onRead: (payload: string) => void }> = ({
  onRead,
}) => {
  const [error, setError] = useState<null | "camera" | "invalid_qr">(null)

  const ref = useCallback(
    (element: HTMLVideoElement) => {
      let stopped = false
      let camera: QrCamera | null = null
      async function showCamera() {
        camera = await frontalCamera(element)
        if (stopped) {
          setTimeout(() => camera?.stop(), 1000)
          camera = null
          return
        }
        if (!camera) {
          setError("camera")
          return
        }

        const stop = frameLoop(() => {
          if (!camera || stopped) {
            stop()
            return
          }

          const res = camera.readFrame(canvas)
          if (!res) return

          try {
            onRead(res)
          } catch (ex) {
            console.error(ex)
            setError("invalid_qr")
          }
        })
      }
      showCamera()

      return () => {
        stopped = true
        camera?.stop()
      }
    },
    [onRead],
  )

  return (
    <div>
      <video ref={ref} poster={error ? videoError : videoPlaceholder} />
    </div>
  )
}
