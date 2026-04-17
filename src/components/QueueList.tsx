import { AppIcon } from './AppIcon'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { SongItem } from '../types'

function QueueRow({
  queueId,
  videoId,
  title,
  channelTitle,
  thumbnail,
  active,
  activeActionKey,
  disabled,
  onPlayNow,
  onRemove,
}: {
  queueId: string
  videoId: string
  title: string
  channelTitle: string
  thumbnail?: string
  active: boolean
  activeActionKey?: string | null
  disabled?: boolean
  onPlayNow: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: queueId })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`row ${active ? 'rowActive' : ''}`}>
      <button className="drag" {...attributes} {...listeners} aria-label="Kéo để sắp xếp" disabled={disabled}>
        ⋮⋮
      </button>
      <button className="rowMain" onClick={onPlayNow} type="button" disabled={disabled}>
        <div className="queueRowContent">
          {thumbnail ? (
            <img className="queueThumb" src={thumbnail} alt="" aria-hidden="true" />
          ) : (
            <div className="queueThumb queueThumbPh" aria-hidden="true" />
          )}
          <div className="rowHead rowHeadStack">
            <div className="title">{title}</div>
            <div className="sub">Kênh: {channelTitle}</div>
            <div className="rowBadgeLine">
              <span className="sourceBadge">YouTube</span>
              <span className="sourceBadge sourceBadgeMuted">ID {videoId}</span>
              {active ? <span className="liveBadge">Đang phát trên YouTube</span> : null}
            </div>
          </div>
        </div>
      </button>
      <div className="rowActions">
        <button
          className={`ghost compactButton buttonWithIcon ${active ? 'buttonToneSuccess buttonStateActive' : 'buttonToneMuted'} ${activeActionKey === `queue-play:${queueId}` ? 'buttonStateActive' : ''}`}
          data-pressed={active || activeActionKey === `queue-play:${queueId}`}
          disabled={disabled}
          onClick={onPlayNow}
          type="button"
        >
          <AppIcon name="play" className="buttonIcon" />
          <span className="buttonLabel">{active ? 'Đang phát' : 'Phát'}</span>
        </button>
        <button
          className={`ghost compactButton buttonToneDanger buttonWithIcon ${activeActionKey === `queue-remove:${queueId}` ? 'buttonStateActive' : ''}`}
          data-pressed={activeActionKey === `queue-remove:${queueId}`}
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          <AppIcon name="clear" className="buttonIcon" />
          <span className="buttonLabel">Xoá</span>
        </button>
      </div>
    </div>
  )
}

export function QueueList({
  queue,
  currentIndex,
  activeActionKey,
  disabled,
  onMove,
  onPlayNow,
  onRemove,
}: {
  queue: SongItem[]
  currentIndex: number
  activeActionKey?: string | null
  disabled?: boolean
  onMove: (from: number, to: number) => void
  onPlayNow: (queueId: string) => void
  onRemove: (queueId: string) => void
}) {
  const ids = useMemo(() => queue.map((x) => x.queueId), [queue])
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (disabled) return
        if (!over || active.id === over.id) return
        const oldIndex = ids.indexOf(String(active.id))
        const newIndex = ids.indexOf(String(over.id))
        const nextIds = arrayMove(ids, oldIndex, newIndex)
        const from = oldIndex
        const to = nextIds.indexOf(String(active.id))
        onMove(from, to)
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="list">
          {queue.map((it, idx) => (
            <QueueRow
              key={it.queueId}
              queueId={it.queueId}
              videoId={it.videoId}
              title={it.title}
              channelTitle={it.channelTitle}
              thumbnail={it.thumbnail}
              active={idx === currentIndex}
              activeActionKey={activeActionKey}
              disabled={disabled}
              onPlayNow={() => onPlayNow(it.queueId)}
              onRemove={() => onRemove(it.queueId)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
