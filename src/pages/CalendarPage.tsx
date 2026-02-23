import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CalendarDays } from "lucide-react";
import RoomCalendar from "@/components/RoomCalendar";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;

const CalendarPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRooms = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setRooms(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user) fetchRooms();
  }, [authLoading, user?.id, fetchRooms]);

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          Calendário
        </h1>
        <p className="text-muted-foreground mt-1">Visualize as datas de liberação das suas salas</p>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">Nenhuma sala</h3>
          <p className="text-muted-foreground">Crie salas para vê-las no calendário.</p>
        </div>
      ) : (
        <RoomCalendar
          rooms={rooms.map((r) => ({
            id: r.id,
            title: r.title,
            unlockAt: r.unlock_at ? new Date(r.unlock_at) : null,
            pinCode: r.pin_code,
          }))}
          onRoomClick={(roomId) => navigate(`/dashboard/room/${roomId}`)}
        />
      )}
    </div>
  );
};

export default CalendarPage;
