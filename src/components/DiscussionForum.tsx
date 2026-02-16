import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Trash2, Reply, ChevronDown, ChevronUp } from "lucide-react";

interface DiscussionPost {
  id: string;
  room_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string | null;
  author_user_id: string | null;
  content: string;
  is_teacher: boolean;
  created_at: string;
}

interface DiscussionForumProps {
  roomId: string;
  /** If provided, user is a teacher */
  teacherUserId?: string;
  /** Student info for posting */
  studentName?: string;
  studentEmail?: string;
}

const DiscussionForum = ({ roomId, teacherUserId, studentName, studentEmail }: DiscussionForumProps) => {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [newPost, setNewPost] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from("discussion_posts")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    setPosts((data as DiscussionPost[]) || []);
  }, [roomId]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel(`forum-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "discussion_posts", filter: `room_id=eq.${roomId}` }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchPosts]);

  const topPosts = posts.filter((p) => !p.parent_id);
  const getReplies = (parentId: string) => posts.filter((p) => p.parent_id === parentId);

  const authorName = teacherUserId ? "Professor" : studentName || "Anônimo";
  const authorEmail = teacherUserId ? null : studentEmail || null;

  const submitPost = async (parentId: string | null, text: string) => {
    if (!text.trim()) return;
    setSending(true);
    await supabase.from("discussion_posts").insert({
      room_id: roomId,
      parent_id: parentId,
      author_name: authorName,
      author_email: authorEmail,
      author_user_id: teacherUserId || null,
      content: text.trim(),
      is_teacher: !!teacherUserId,
    } as any);
    if (parentId) {
      setReplyText("");
      setReplyTo(null);
      setExpandedReplies((prev) => new Set(prev).add(parentId));
    } else {
      setNewPost("");
    }
    setSending(false);
  };

  const deletePost = async (id: string) => {
    await supabase.from("discussion_posts").delete().eq("id", id);
  };

  const toggleReplies = (id: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="space-y-4">
      {/* New Post */}
      <div className="bg-card border border-border rounded-xl p-4">
        <Textarea
          placeholder="Escreva sua dúvida ou comentário sobre o material..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          rows={3}
          className="resize-y text-sm mb-3"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => submitPost(null, newPost)} disabled={!newPost.trim() || sending}>
            <Send className="w-4 h-4 mr-1" /> Publicar
          </Button>
        </div>
      </div>

      {/* Posts */}
      {topPosts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2" />
          <p>Nenhuma discussão ainda. Seja o primeiro a perguntar!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topPosts.map((post) => {
            const replies = getReplies(post.id);
            const isExpanded = expandedReplies.has(post.id);
            return (
              <div key={post.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${post.is_teacher ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                        {post.is_teacher ? "Professor" : post.author_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {teacherUserId && (
                        <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Reply className="w-3.5 h-3.5" /> Responder
                    </button>
                    {replies.length > 0 && (
                      <button onClick={() => toggleReplies(post.id)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {replies.length} resposta{replies.length > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                </div>

                {/* Reply form */}
                {replyTo === post.id && (
                  <div className="border-t border-border p-4 bg-secondary/30">
                    <Textarea
                      placeholder="Escreva sua resposta..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      className="resize-y text-sm mb-2"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText(""); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => submitPost(post.id, replyText)} disabled={!replyText.trim() || sending}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Responder
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {isExpanded && replies.length > 0 && (
                  <div className="border-t border-border">
                    {replies.map((reply) => (
                      <div key={reply.id} className="p-4 pl-8 border-b border-border last:border-b-0 bg-secondary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${reply.is_teacher ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                            {reply.is_teacher ? "Professor" : reply.author_name}
                          </span>
                          <span className="text-xs text-muted-foreground">{timeAgo(reply.created_at)}</span>
                          {teacherUserId && (
                            <button onClick={() => deletePost(reply.id)} className="text-muted-foreground hover:text-destructive p-1 ml-auto">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiscussionForum;
