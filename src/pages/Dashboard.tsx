import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, LogOut, BookOpen, Users, Clock, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;

const Dashboard = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      fetchRooms();
    };
    checkAuth();
  }, [navigate]);

  const fetchRooms = async () => {
    const { data } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
    setRooms(data || []);
    setLoading(false);
  };

  const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();

  const createRoom = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("rooms").insert({
      title: newTitle.trim(),
      pin_code: generatePin(),
      teacher_id: user.id,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewTitle("");
      setDialogOpen(false);
      fetchRooms();
      toast({ title: "Sala criada!" });
    }
    setCreating(false);
  };

  const deleteRoom = async (id: string) => {
    await supabase.from("rooms").delete().eq("id", id);
    fetchRooms();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">FlipClass</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Minhas Salas</h1>
            <p className="text-muted-foreground mt-1">Gerencie suas salas de aula invertida</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Nova Sala
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Criar Nova Sala</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Título da sala</Label>
                  <Input
                    placeholder="Ex: Biologia - Fotossíntese"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  />
                </div>
                <Button onClick={createRoom} disabled={creating || !newTitle.trim()} className="w-full font-semibold">
                  {creating ? "Criando..." : "Criar Sala"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Carregando...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Nenhuma sala criada</h3>
            <p className="text-muted-foreground">Crie sua primeira sala de aula invertida.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group"
                onClick={() => navigate(`/dashboard/room/${room.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-display font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors">
                    {room.title}
                  </h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    PIN: <span className="font-mono font-bold text-foreground">{room.pin_code}</span>
                  </div>
                  {room.unlock_at && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(room.unlock_at) > new Date() ? "Bloqueado" : "Liberado"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
