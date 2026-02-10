import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export function ChatDialog({ open, onOpenChange, recipientId, recipientName }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user && recipientId) {
      fetchMessages();
      markMessagesAsRead();

      // Subscribe to realtime messages
      const channel = supabase
        .channel(`chat-${user.id}-${recipientId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${recipientId}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (newMsg.recipient_id === user.id) {
              setMessages((prev) => [...prev, newMsg]);
              markMessagesAsRead();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, user, recipientId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const fetchMessages = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', recipientId)
        .eq('recipient_id', user.id)
        .eq('read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large", { description: "Maximum file size is 10MB" });
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("Invalid file type", { description: "Only images, PDFs, and Word documents are allowed" });
      return;
    }

    setSelectedFile(file);
    
    // Create preview for images
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      type: file.type,
      name: file.name
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || isSending) return;

    setIsSending(true);
    try {
      let attachment: { url: string; type: string; name: string } | null = null;
      
      if (selectedFile) {
        attachment = await uploadFile(selectedFile);
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content: newMessage.trim() || (selectedFile ? `Sent ${selectedFile.name}` : ''),
          attachment_url: attachment?.url || null,
          attachment_type: attachment?.type || null,
          attachment_name: attachment?.name || null,
        })
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      setNewMessage("");
      clearSelectedFile();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const isImageAttachment = (type: string | null | undefined) => {
    return type && ALLOWED_IMAGE_TYPES.includes(type);
  };

  const renderAttachment = (message: Message) => {
    if (!message.attachment_url) return null;

    if (isImageAttachment(message.attachment_type)) {
      return (
        <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img 
            src={message.attachment_url} 
            alt={message.attachment_name || 'Attachment'} 
            className="max-w-full rounded-lg max-h-48 object-cover"
          />
        </a>
      );
    }

    return (
      <a 
        href={message.attachment_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-2 p-2 rounded bg-background/20 hover:bg-background/30 transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span className="text-sm truncate">{message.attachment_name || 'Download file'}</span>
      </a>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat with {recipientName}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((message) => {
                const isOwn = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.content && <p className="text-sm">{message.content}</p>}
                      {renderAttachment(message)}
                      <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(message.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* File Preview */}
        {selectedFile && (
          <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded" />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={clearSelectedFile}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2 pt-4 border-t">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept={ALLOWED_FILE_TYPES.join(',')}
            className="hidden"
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending}
          />
          <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !selectedFile)}>
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}