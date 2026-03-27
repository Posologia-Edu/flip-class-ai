import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { QuestionComponentProps, DragAndDropQuestion as DDQuestion } from "./types";

function DraggableItem({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none touch-none"
    >
      {children}
    </div>
  );
}

function DroppableCategory({ id, children, label }: { id: string; children: React.ReactNode; label: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[100px] border-2 border-dashed rounded-xl p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border bg-secondary/30"
      }`}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function DragAndDropQuestionComponent({ question, value, onChange, disabled }: QuestionComponentProps) {
  const q = question as DDQuestion;
  const mapping: Record<string, string> = value || {};
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const unassigned = q.items.filter((item) => !mapping[item]);
  const categorized = q.categories.reduce<Record<string, string[]>>((acc, cat) => {
    acc[cat] = q.items.filter((item) => mapping[item] === cat);
    return acc;
  }, {});

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const item = active.id as string;
      const category = over.id as string;

      if (category === "unassigned") {
        const newMapping = { ...mapping };
        delete newMapping[item];
        onChange(newMapping);
      } else if (q.categories.includes(category)) {
        onChange({ ...mapping, [item]: category });
      }
    },
    [mapping, onChange, q.categories]
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Unassigned items */}
        <DroppableCategory id="unassigned" label="Itens para arrastar">
          {unassigned.map((item) => (
            <DraggableItem key={item} id={item} disabled={disabled}>
              {item}
            </DraggableItem>
          ))}
          {unassigned.length === 0 && <p className="text-xs text-muted-foreground italic">Todos os itens foram distribuídos</p>}
        </DroppableCategory>

        {/* Category zones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.categories.map((cat) => (
            <DroppableCategory key={cat} id={cat} label={cat}>
              {(categorized[cat] || []).map((item) => (
                <DraggableItem key={item} id={item} disabled={disabled}>
                  {item}
                </DraggableItem>
              ))}
            </DroppableCategory>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-lg">
            {activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
