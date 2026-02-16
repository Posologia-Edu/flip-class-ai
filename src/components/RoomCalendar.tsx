import { useState, useMemo } from "react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, BookOpen, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface RoomEvent {
  id: string;
  title: string;
  unlockAt: Date | null;
  pinCode: string;
}

interface RoomCalendarProps {
  rooms: RoomEvent[];
  onRoomClick?: (roomId: string) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const RoomCalendar = ({ rooms, onRoomClick }: RoomCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, RoomEvent[]>();
    rooms.forEach((room) => {
      if (room.unlockAt) {
        const key = format(room.unlockAt, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(room);
      }
    });
    return map;
  }, [rooms]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return rooms
      .filter((r) => r.unlockAt && r.unlockAt > now)
      .sort((a, b) => a.unlockAt!.getTime() - b.unlockAt!.getTime())
      .slice(0, 5);
  }, [rooms]);

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === currentMonth.getMonth();
  };

  return (
    <div className="space-y-6">
      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Agenda</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-display text-sm font-semibold text-foreground min-w-[140px] text-center capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(key) || [];
            const hasEvents = dayEvents.length > 0;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const inMonth = isCurrentMonth(day);
            const today = isToday(day);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                className={`relative p-2 min-h-[72px] border-b border-r border-border text-left transition-colors hover:bg-secondary/50 ${
                  !inMonth ? "opacity-30" : ""
                } ${isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}
              >
                <span className={`text-xs font-medium ${
                  today ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" :
                  "text-foreground"
                }`}>
                  {format(day, "d")}
                </span>
                {hasEvents && inMonth && (
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((evt) => {
                      const isPast = evt.unlockAt && evt.unlockAt <= new Date();
                      return (
                        <div
                          key={evt.id}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium ${
                            isPast
                              ? "bg-primary/10 text-primary"
                              : "bg-accent/10 text-accent-foreground"
                          }`}
                        >
                          {evt.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={format(selectedDate, "yyyy-MM-dd")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-display text-sm font-semibold text-muted-foreground mb-3 capitalize">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((evt) => {
                  const isPast = evt.unlockAt && evt.unlockAt <= new Date();
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onRoomClick?.(evt.id)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPast ? "bg-primary/10" : "bg-accent/10"}`}>
                        {isPast ? <Unlock className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-accent" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{evt.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {evt.unlockAt ? format(evt.unlockAt, "HH:mm") : "Sem horário"}
                          {isPast ? " — Liberado" : " — Bloqueado"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming Events Sidebar */}
      {upcomingEvents.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Próximos Desbloqueios
          </h3>
          <div className="space-y-2">
            {upcomingEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onRoomClick?.(evt.id)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-accent uppercase">
                    {format(evt.unlockAt!, "MMM", { locale: ptBR })}
                  </span>
                  <span className="text-sm font-bold text-foreground leading-none">
                    {format(evt.unlockAt!, "dd")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{evt.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(evt.unlockAt!, "EEEE, HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomCalendar;
