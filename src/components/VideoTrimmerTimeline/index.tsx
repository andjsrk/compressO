import {
  Timeline,
  TimelineEditor,
  TimelineState,
} from '@xzdarcy/react-timeline-editor'
import {
  TimelineAction,
  TimelineEffect,
  TimelineRow,
} from '@xzdarcy/timeline-engine'
import { cloneDeep } from 'lodash'
import {
  FC,
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react'

import Tooltip from '../Tooltip'

export const rowIds = {
  videoBoundary: 'video-boundary',
  videoTrim: 'video-trim',
} as const

const effects = {
  effectVideoBoundary: {
    id: rowIds.videoBoundary,
  },
  effectVideoTrim: {
    id: rowIds.videoTrim,
  },
} satisfies Record<string, TimelineEffect>

const generateActionId = () =>
  `trim_action_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

/**
 * Updates the minStart and maxEnd constraints for all trim actions to prevent overlaps while allowing movement within available left/right space
 */
const updateActionConstraints = (
  actions: TimelineAction[],
  videoDuration: number,
): TimelineAction[] => {
  const sortedActions = [...actions].sort((a, b) => a.start - b.start)

  return sortedActions.map((action, index) => {
    const leftNeighbor = index > 0 ? sortedActions[index - 1] : null
    const rightNeighbor =
      index < sortedActions.length - 1 ? sortedActions[index + 1] : null

    const minStart = leftNeighbor ? leftNeighbor.end : 0
    const maxEnd = rightNeighbor ? rightNeighbor.start : videoDuration

    return {
      ...action,
      minStart,
      maxEnd,
    }
  })
}

const getDefaultEditorData = ({
  duration,
  trimActions,
}: {
  duration: number
  trimActions?: TimelineAction[]
}): TimelineRow[] => {
  const defaultTrimActions =
    trimActions && trimActions.length > 0
      ? cloneDeep(trimActions)
      : [
          {
            id: generateActionId(),
            start: 0,
            minStart: 0,
            end: duration,
            maxEnd: duration,
            effectId: effects.effectVideoTrim.id,
            movable: true,
          },
        ]
  return [
    {
      id: rowIds.videoBoundary,
      actions: [
        {
          id: 'action0',
          start: 0,
          minStart: 0,
          end: duration,
          maxEnd: duration,
          effectId: effects.effectVideoBoundary.id,
          movable: false,
          disable: true,
          flexible: false,
        },
      ],
    },
    {
      id: rowIds.videoTrim,
      actions: defaultTrimActions,
    },
  ]
}

export const scales = {
  scale: 1,
  scaleWidth: 50,
  startLeft: 20,
} as const

export const TrimRow: FC<{
  action: TimelineAction
  row: TimelineRow
  onSplit?: (actionId: string, splitTime: number) => void
  onClick?: (actionId: string) => void
  isSelected?: boolean
}> = ({ action, onSplit, onClick, isSelected = false }) => {
  const handleSplitClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.detail === 1) {
      onClick?.(action.id)
    } else if (e.detail === 2) {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickRatio = clickX / rect.width
      const splitTime = action.start + (action.end - action.start) * clickRatio
      onSplit?.(action.id, splitTime)
    }
  }

  return (
    <Tooltip
      content={
        <div className="flex flex-col items-center justify-center">
          <p>Click to select</p>
          <p>Double click to split</p>
        </div>
      }
      delay={500}
    >
      <div
        className={`flex justify-center items-center h-8 rounded-lg cursor-pointer group relative bg-primary`}
        onClick={handleSplitClick}
      >
        <div className="text-center text-white1">{`${(
          action.end - action.start
        ).toFixed(2)}s`}</div>
        <div className="absolute inset-0 border-2 border-white/30 opacity-0 group-hover:opacity-100 rounded-lg pointer-events-none" />
        {isSelected ? (
          <>
            <div className="absolute inset-0 bg-white/20 rounded-lg pointer-events-none border-2 border-black1 dark:border-white1" />
          </>
        ) : null}
      </div>
    </Tooltip>
  )
}

export const BoundaryRow: FC<{
  action: TimelineAction
  row: TimelineRow
}> = ({ action }) => {
  return (
    <div className="flex justify-center items-center bg-primary h-[2px] mt-3 rounded-lg">
      <p className="text-center text-white1">{`${(
        action.end - action.start
      ).toFixed(2)}s`}</p>
    </div>
  )
}

export interface VideoTrimmerTimelineProps
  extends Omit<TimelineEditor, 'editorData' | 'effects'> {
  id: string
  duration: number
  initialTrimActions?: TimelineAction[]
  onChange?: (data: TimelineRow[]) => void
  onEditorDataChange?: (data: TimelineRow[]) => void
}

export interface VideoTrimmerTimelineRef extends TimelineState {}

const VideoTrimmerTimeline = forwardRef(
  (
    {
      id,
      duration,
      initialTrimActions,
      style,
      onChange,
      onEditorDataChange,
      ...props
    }: VideoTrimmerTimelineProps,
    forwardedRef: ForwardedRef<VideoTrimmerTimelineRef>,
  ) => {
    const [editorData, setEditorData] = useState<TimelineRow[]>(() =>
      getDefaultEditorData({ duration, trimActions: initialTrimActions }),
    )
    const [selectedActionId, setSelectedActionId] = useState<string | null>(
      null,
    )

    const updateEditorDataWithConstraints = useCallback(
      (newData: TimelineRow[] | ((prev: TimelineRow[]) => TimelineRow[])) => {
        setEditorData((prevData) => {
          const updatedData =
            typeof newData === 'function' ? newData(prevData) : newData

          return updatedData.map((row) => {
            if (row.id === rowIds.videoTrim) {
              return {
                ...row,
                actions: updateActionConstraints(row.actions, duration),
              }
            }
            return row
          })
        })
      },
      [duration],
    )

    const handleSplitAction = useCallback(
      (actionId: string, splitTime: number) => {
        updateEditorDataWithConstraints((prevData) =>
          prevData.map((row) => {
            if (row.id === rowIds.videoTrim) {
              const actionToSplit = row.actions.find((a) => a.id === actionId)
              if (!actionToSplit) return row

              const minSplitSize = 0.5
              if (
                splitTime - actionToSplit.start < minSplitSize ||
                actionToSplit.end - splitTime < minSplitSize
              ) {
                return row
              }

              const leftAction: TimelineAction = {
                ...actionToSplit,
                id: generateActionId(),
                end: splitTime,
              }
              const rightAction: TimelineAction = {
                ...actionToSplit,
                id: generateActionId(),
                start: splitTime,
              }

              const newActions = row.actions.flatMap((action) =>
                action.id === actionId ? [leftAction, rightAction] : [action],
              )

              setSelectedActionId(null)

              return { ...row, actions: newActions }
            }
            return row
          }),
        )
      },
      [updateEditorDataWithConstraints],
    )

    const handleDeleteAction = useCallback(
      (actionId: string) => {
        if (!actionId) return

        const trimRow = editorData.find((row) => row.id === rowIds.videoTrim)
        const canDelete = trimRow && trimRow.actions.length > 1

        if (!canDelete) {
          return
        }

        updateEditorDataWithConstraints((prevData) =>
          prevData.map((row) => {
            if (row.id === rowIds.videoTrim) {
              if (row.actions.length > 1) {
                const newActions = row.actions.filter(
                  (action) => action.id !== actionId,
                )

                setSelectedActionId(null)

                return { ...row, actions: newActions }
              }
            }
            return row
          }),
        )
      },
      [editorData, updateEditorDataWithConstraints],
    )

    useEffect(() => {
      function handleKeyDown(evt: KeyboardEvent) {
        if (evt.key == 'Backspace' || evt.key == 'Delete') {
          handleDeleteAction?.(selectedActionId!)
        }
      }
      if (selectedActionId) {
        window.addEventListener('keydown', handleKeyDown)
      } else {
        window.removeEventListener('keydown', handleKeyDown)
      }
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [handleDeleteAction, selectedActionId])

    useEffect(() => {
      onEditorDataChange?.(editorData)
    }, [editorData, onEditorDataChange])

    return (
      <div className="space-y-2">
        <Timeline
          key={id}
          ref={forwardedRef}
          editorData={editorData}
          effects={effects}
          autoScroll
          scaleWidth={scales.scaleWidth}
          scale={scales.scale}
          startLeft={scales.startLeft}
          style={{
            width: '100%',
            height: '125px',
            borderRadius: '10px',
            ...(style ?? {}),
          }}
          getActionRender={(action, row) => {
            if (action.effectId === effects.effectVideoBoundary.id) {
              return <BoundaryRow action={action} row={row} />
            } else if (action.effectId === effects.effectVideoTrim.id) {
              return (
                <TrimRow
                  action={action}
                  row={row}
                  onSplit={handleSplitAction}
                  onClick={setSelectedActionId}
                  isSelected={selectedActionId === action.id}
                />
              )
            }
          }}
          {...props}
          onChange={(data) => {
            updateEditorDataWithConstraints(data)
            onChange?.(data)
          }}
        />
      </div>
    )
  },
)

export default VideoTrimmerTimeline
