import { useState, useEffect, useCallback } from "react";
import { Bell, X, BookOpen, Unlock, Clock, MessageSquare, Users, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  room_id: string;
  session_id: string | null;
  teacher_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  material_added: <BookOpen className="w-4 h-4 text-primary" />,
  activity_unlocked: <Unlock className="w-4 h-4 text-accent" />,
  deadline_approaching: <Clock className="w-4 h-4 text-destructive" />,
  peer_review_received: <Users className="w-4 h-4 text-primary" />,
  feedback_received: <MessageSquare className="w-4 h-4 text-primary" />,
};

interface NotificationCenterProps {
  sessionId?: string;
  teacherId?: string;
  roomId?: string;
}

const NotificationCenter = ({ sessionId, teacherId, roomId }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    } else if (teacherId && roomId) {
      query = query.eq("room_id", roomId).is("session_id", null);
    } else if (teacherId) {
      query = query.eq("teacher_id", teacherId);
    } else {
      return;
    }

    const { data } = await query;
    setNotifications((data as Notification[]) || []);
  }, [sessionId, teacherId, roomId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Only add if relevant to this user
          if (
            (sessionId && newNotif.session_id === sessionId) ||
            (teacherId && newNotif.teacher_id === teacherId)
          ) {
            setNotifications((prev) => [newNotif, ...prev].slice(0, 30));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, teacherId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 max-h-[420px] bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-display text-sm font-bold text-foreground">Notificações</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhuma notificação
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => !notif.read && markAsRead(notif.id)}
                      className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-secondary/50 ${
                        !notif.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {typeIcons[notif.type] || <Bell className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!notif.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="shrink-0 mt-1">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
