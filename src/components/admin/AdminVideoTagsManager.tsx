import { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { getVideos } from '@/lib/api';
import type { Video } from '@/types/index';

interface VideoTagConfig {
  videoId: string;
  tags: string[];
  animationStyle: 'pulse' | 'glow' | 'bounce' | 'marquee';
}

const STORAGE_KEY = 'zedvevo_video_tags_config';

export default function AdminVideoTagsManager() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('NOW PLAYING, ZEDVEVO EXCLUSIVE, HIT TRACK');
  const [animationStyle, setAnimationStyle] = useState<'pulse' | 'glow' | 'bounce' | 'marquee'>('pulse');
  const [configs, setConfigs] = useState<Record<string, VideoTagConfig>>({});

  useEffect(() => {
    getVideos({ limit: 100 }).then(v => {
      setVideos(v);
      if (v.length > 0) setSelectedVideoId(v[0].id);
    }).catch(console.error);

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfigs(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (selectedVideoId && configs[selectedVideoId]) {
      setTagInput(configs[selectedVideoId].tags.join(', '));
      setAnimationStyle(configs[selectedVideoId].animationStyle || 'pulse');
    } else {
      setTagInput('NOW PLAYING, ZEDVEVO EXCLUSIVE');
      setAnimationStyle('pulse');
    }
  }, [selectedVideoId]);

  const handleSave = () => {
    if (!selectedVideoId) return;
    const tagsArray = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    const updated = {
      ...configs,
      [selectedVideoId]: {
        videoId: selectedVideoId,
        tags: tagsArray.length > 0 ? tagsArray : ['ZEDVEVO NOW PLAYING'],
        animationStyle,
      }
    };
    setConfigs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success('Video tags and animation style saved successfully!');
  };

  return (
    <Card className="bg-card border-border shadow-md">
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" /> Video Custom Tags & Animation Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Select Video</Label>
          <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Choose a video..." />
            </SelectTrigger>
            <SelectContent>
              {videos.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.title} ({v.artist_name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Tags (comma-separated)</Label>
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="e.g. NOW PLAYING, ZEDVEVO EXCLUSIVE, 4K ULTRA"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Tag Animation Style</Label>
          <Select value={animationStyle} onValueChange={(v: any) => setAnimationStyle(v)}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select animation..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pulse">Pulse Glow (Recommended)</SelectItem>
              <SelectItem value="glow">Neon Border Glow</SelectItem>
              <SelectItem value="bounce">Bouncing Badge</SelectItem>
              <SelectItem value="marquee">Scrolling Marquee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            <Save className="w-4 h-4" /> Save Video Tags & Animation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
