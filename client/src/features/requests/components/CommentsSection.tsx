import { useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@/shared/components/ui";
import { Textarea } from "@/shared/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Send } from "lucide-react";

interface Comment {
  id: string;
  user: string;
  avatar?: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
}

export function CommentsSection() {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: "1",
      user: "System",
      text: "Request created. Waiting for a broker to be assigned.",
      timestamp: new Date(Date.now() - 86400000),
      isMe: false,
    },
  ]);
  const [newComment, setNewComment] = useState("");

  const handleSend = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      user: "You",
      text: newComment,
      timestamp: new Date(),
      isMe: true,
    };

    setComments([...comments, comment]);
    setNewComment("");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <h3 className="font-semibold">Project Discussion</h3>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-4 gap-4 h-[400px]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`flex gap-3 ${comment.isMe ? "flex-row-reverse" : ""}`}
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback>{comment.user.charAt(0)}</AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  comment.isMe
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p>{comment.text}</p>
                <span className="text-[10px] opacity-70 block mt-1 text-right">
                  {comment.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-2 pt-2 border-t">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-[100px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newComment.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
