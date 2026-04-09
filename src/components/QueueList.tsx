import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { SongItem } from '../types'

function QueueRow({
  queueId,
  title,
  channelTitle,
  active,
  onPlayNow,
  onRemove,
}: {
  queueId: string
  title: string
  channelTitle: string
  active: boolean
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
      <button className="drag" {...attributes} {...listeners} aria-label="Kéo để sắp xếp">
        ⋮⋮
      </button>
      <button className="rowMain" onClick={onPlayNow} type="button">
        <div className="rowHead">
          <div className="title">{title}</div>
          {active ? <span className="liveBadge">Đang phát</span> : null}
        </div>
        <div className="sub">Kênh: {channelTitle}</div>
      </button>
      <div className="rowActions">
        <button className="ghost compactButton" onClick={onPlayNow} type="button">
          {active ? 'Đang phát' : 'Phát'}
        </button>
        <button className="danger compactButton" onClick={onRemove} type="button">
          Xoá
        </button>
      </div>
    </div>
  )
}

export function QueueList({
  queue,
  currentIndex,
  onMove,
  onPlayNow,
  onRemove,
}: {
  queue: SongItem[]
  currentIndex: number
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
              title={it.title}
              channelTitle={it.channelTitle}
              active={idx === currentIndex}
              onPlayNow={() => onPlayNow(it.queueId)}
              onRemove={() => onRemove(it.queueId)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
