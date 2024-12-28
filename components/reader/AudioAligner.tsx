import { useState } from 'react';
import { FileAudio, Wand2 } from 'lucide-react';
import { alignAudioWithText } from '@/lib/audio-aligner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AudioAlignerProps {
  chapterId: string;
  text: string;
  onAlignmentComplete: (alignments: any[]) => void;
}

export function AudioAligner({ chapterId, text, onAlignmentComplete }: AudioAlignerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAligning, setIsAligning] = useState(false);
  const { toast } = useToast();

  const handleAlignment = async () => {
    if (!audioFile) return;
    
    setIsAligning(true);
    try {
      const alignments = await alignAudioWithText(audioFile, text, chapterId);
      onAlignmentComplete(alignments);
      toast({
        title: "Audio aligned successfully",
        description: "You can now click on text to play the corresponding audio.",
      });
    } catch (error) {
      toast({
        title: "Audio alignment failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsAligning(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">音频对齐</h2>
      {!audioFile ? (
        <label className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
          <FileAudio className="h-8 w-8 text-primary" />
          <span className="text-muted-foreground">上传音频文件</span>
          <input
            type="file"
            className="hidden"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAudioFile(file);
            }}
          />
        </label>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{audioFile.name}</p>
          <Button
            className="w-full"
            onClick={handleAlignment}
            disabled={isAligning}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {isAligning ? '正在对齐...' : '开始音文对齐'}
          </Button>
        </div>
      )}
    </div>
  );
}