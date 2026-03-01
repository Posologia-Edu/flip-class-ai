import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { supabase } from "@/integrations/supabase/client";
import UpgradeGate from "@/components/UpgradeGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, BookOpen, Upload, Palette, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Teacher {
  email: string;
  name: string;
  status: string;
  userId: string | null;
  roomCount: number;
  studentCount: number;
  completionRate: number;
}

interface InstitutionSettings {
  institution_name: string;
  logo_url: string;
  primary_color: string;
}

const InstitutionalDashboard = () => {
  const { user } = useAuth();
  const { canUseMultiTeacher, canUseWhiteLabel } = useFeatureGate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InstitutionSettings>({
    institution_name: "",
    logo_url: "",
    primary_color: "#0d9488",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const fetchTeachers = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("institutional-dashboard", {
        body: { action: "get_teachers" },
      });
      if (error) throw error;
      setTeachers(data?.teachers || []);
    } catch (err: any) {
      console.error("Error fetching teachers:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("institution_settings" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        institution_name: (data as any).institution_name || "",
        logo_url: (data as any).logo_url || "",
        primary_color: (data as any).primary_color || "#0d9488",
      });
    }
  }, [user]);

  useEffect(() => {
    fetchTeachers();
    fetchSettings();
  }, [fetchTeachers, fetchSettings]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("institution_settings" as any)
        .upsert({
          user_id: user.id,
          institution_name: settings.institution_name,
          logo_url: settings.logo_url,
          primary_color: settings.primary_color,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `institution-logos/${user.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("materials").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("materials").getPublicUrl(path);
      setSettings((s) => ({ ...s, logo_url: urlData.publicUrl }));
      toast({ title: "Logo enviado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const totalRooms = teachers.reduce((s, t) => s + t.roomCount, 0);
  const totalStudents = teachers.reduce((s, t) => s + t.studentCount, 0);
  const avgCompletion = teachers.length > 0
    ? Math.round(teachers.reduce((s, t) => s + t.completionRate, 0) / teachers.filter(t => t.studentCount > 0).length || 0)
    : 0;

  const content = (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" /> Painel Institucional
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie professores e personalize sua instituição</p>
      </div>

      <Tabs defaultValue="teachers">
        <TabsList className="mb-6">
          <TabsTrigger value="teachers"><Users className="w-4 h-4 mr-1" /> Professores</TabsTrigger>
          <TabsTrigger value="whitelabel"><Palette className="w-4 h-4 mr-1" /> Personalização</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Professores</p>
              <p className="font-display text-2xl font-bold text-foreground">{teachers.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Salas Total</p>
              <p className="font-display text-2xl font-bold text-foreground">{totalRooms}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Alunos Total</p>
              <p className="font-display text-2xl font-bold text-foreground">{totalStudents}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Taxa Conclusão</p>
              <p className="font-display text-2xl font-bold text-foreground">{avgCompletion}%</p>
            </div>
          </div>

          {/* Teachers Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum professor vinculado.</p>
              <p className="text-xs text-muted-foreground mt-1">Convide professores no painel de Administração.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Professor</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Salas</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Alunos</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Conclusão</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </td>
                      <td className="text-center p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.status === "active" ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
                        }`}>
                          {t.status === "active" ? "Ativo" : "Pendente"}
                        </span>
                      </td>
                      <td className="text-center p-3 text-foreground">{t.roomCount}</td>
                      <td className="text-center p-3 text-foreground">{t.studentCount}</td>
                      <td className="text-center p-3 text-foreground">{t.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="whitelabel">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg space-y-6">
            <div>
              <Label htmlFor="inst-name">Nome da Instituição</Label>
              <Input
                id="inst-name"
                value={settings.institution_name}
                onChange={(e) => setSettings((s) => ({ ...s, institution_name: e.target.value }))}
                placeholder="Ex: Colégio Exemplo"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Logo da Instituição</Label>
              <div className="flex items-center gap-4 mt-2">
                {settings.logo_url && (
                  <img src={settings.logo_url} alt="Logo" className="w-12 h-12 rounded-lg object-contain border border-border" />
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploadingLogo}>
                    <span>
                      {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="primary-color">Cor Primária</Label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  id="primary-color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
                  className="w-32"
                />
              </div>
            </div>

            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <UpgradeGate allowed={canUseMultiTeacher()} featureName="Painel Institucional" planRequired="Institucional">
      {content}
    </UpgradeGate>
  );
};

export default InstitutionalDashboard;
