
import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { wizardService } from "../services/wizardService";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui";

interface StepB5Props {
  description: string;
  setDescription: (val: string) => void;
  title: string;
  setTitle: (val: string) => void;
  onFileUploaded: (url: string) => void;
}

export function StepB5({ description, setDescription, title, setTitle, onFileUploaded }: StepB5Props) {
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const res = await wizardService.uploadFile(file);
            setFileName(res.filename);
            onFileUploaded(res.url); // Pass mock URL back
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = () => {
        setFileName(null);
        // In real app, might want to clear from parent/state too
    };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">Mô tả ý tưởng</h2>
        <p className="text-muted-foreground mt-2">Chi tiết càng rõ, sản phẩm càng đúng ý bạn</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
           <Label htmlFor="title">Tên dự án (ngắn gọn)</Label>
           <Input 
             id="title" 
             placeholder="Ví dụ: Website bán quần áo trẻ em" 
             value={title}
             onChange={(e) => setTitle(e.target.value)}
           />
        </div>

        <div className="space-y-2">
            <Label htmlFor="description">Mô tả chi tiết</Label>
            <Textarea
                id="description"
                className="min-h-[150px]"
                placeholder="Mô tả các yêu cầu đặc biệt, khách hàng mục tiêu, màu sắc chủ đạo..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
        </div>

        <div className="space-y-2">
            <Label>Tài liệu tham khảo (nếu có)</Label>
            {!fileName ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                    <Input 
                        type="file" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Upload className="w-8 h-8" />
                        <p>{uploading ? "Đang tải lên..." : "Kéo thả file hoặc click để tải lên"}</p>
                        <p className="text-xs">PDF, DOCX, PNG, JPG (Max 10MB)</p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium text-sm truncate max-w-[200px]">{fileName}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
