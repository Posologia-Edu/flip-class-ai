import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { QuestionComponentProps, OrderingQuestion as OQuestion } from "./types";

function SortableItem({ id, index, children, disabled }: { id: string; index: number; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg select-none"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
        {index + 1}
      </span>
      <span className="text-sm flex-1">{children}</span>
    </div>
  );
}

export default function OrderingQuestionComponent({ question, value, onChange, disabled }: QuestionComponentProps) {
  const q = question as OQuestion;

  // Initialize with shuffled order if no value
  const currentOrder: string[] = value || [...q.items].sort(() => Math.random() - 0.5);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      onChange(newOrder);
    },
    [currentOrder, onChange]
  );

  // Create unique IDs for sortable context
  const itemIds = currentOrder.map((item) => item);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Arraste os itens para colocá-los na ordem correta.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {currentOrder.map((item, idx) => (
              <SortableItem key={item} id={item} index={idx} disabled={disabled}>
                {item}
              </SortableItem>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="flex items-center gap-3 p-3 bg-primary text-primary-foreground rounded-lg shadow-lg">
              <GripVertical className="w-4 h-4" />
              <span className="text-sm">{activeId}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
