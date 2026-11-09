import { useState, useEffect } from 'react';
import { Megaphone, Save, Film, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { getVideos } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Video } from '@/types/index';

interface VideoAdPlacementConfig {
  videoId: string;
  bannerPlacement: 'above_play_button' | 'below_play_button' | 'between_list_items' | 'none';
  popunderPlacement: 'on_click' | 'on_play' | 'on_download' | 'none';
}

const SETTINGS_KEY = 'video_ad_placements_config';

export default function AdminVideoAdPlacements() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [bannerPlacement, setBannerPlacement] = useState<VideoAdPlacementConfig['bannerPlacement']>('below_play_button');
  const [popunderPlacement, setPopunderPlacement] = useState<VideoAdPlacementConfig['popunderPlacement']>('on_play');
  const [placementsMap, setPlacementsMap] = useState<Record<string, VideoAdPlacementConfig>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getVideos({ limit: 100 }).then(v => {
      setVideos(v);
      if (v.length > 0) setSelectedVideoId(v[0].id);
    }).catch(console.error);

    // Load from Supabase app_settings or localStorage fallback
    async function loadConfig() {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
        if (data?.value) {
          const parsed = JSON.parse(data.value);
          setPlacementsMap(parsed);
        } else {
          const local = localStorage.getItem(SETTINGS_KEY);
          if (local) setPlacementsMap(JSON.parse(local));
        }
      } catch {
        const local = localStorage.getItem(SETTINGS_KEY);
        if (local) setPlacementsMap(JSON.parse(local));
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (selectedVideoId && placementsMap[selectedVideoId]) {
      setBannerPlacement(placementsMap[selectedVideoId].bannerPlacement || 'below_play_button');
      setPopunderPlacement(placementsMap[selectedVideoId].popunderPlacement || 'on_play');
    } else {
      setBannerPlacement('below_play_button');
      setPopunderPlacement('on_play');
    }
  }, [selectedVideoId, placementsMap]);

  const handleSave = async () => {
    if (!selectedVideoId) return;
    setSaving(true);
    try {
      const updated = {
        ...placementsMap,
        [selectedVideoId]: {
          videoId: selectedVideoId,
          bannerPlacement,
          popunderPlacement,
        }
      };
      setPlacementsMap(updated);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

      // Save to Supabase database
      await supabase.from('app_settings').upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(updated),
        description: 'Per-video ad placements (banner & popunder) configured by Admin',
        updated_at: new Date().toISOString()
      });

      toast.success('Video ad placement preferences saved to database successfully!');
    } catch (e: any) {
      toast.error('Failed to save to database: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-md">
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" /> Per-Video Ad Placements (Banner & Popunder)
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Select specific placement positions for banner ads and popunder ads for each individual video. Preferences are stored persistently in the database.
        </CardDescription>
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
          <Label className="text-xs font-semibold">Banner Ad Placement</Label>
          <Select value={bannerPlacement} onValueChange={(v: any) => setBannerPlacement(v)}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select banner position..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above_play_button">Above Play Button</SelectItem>
              <SelectItem value="below_play_button">Below Play Button (Recommended)</SelectItem>
              <SelectItem value="between_list_items">Between List Items / Feed</SelectItem>
              <SelectItem value="none">Disabled for this video</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Popunder Ad Trigger Placement</Label>
          <Select value={popunderPlacement} onValueChange={(v: any) => setPopunderPlacement(v)}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select popunder trigger..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_click">Trigger on Card Click</SelectItem>
              <SelectItem value="on_play">Trigger on Video Play (Recommended)</SelectItem>
              <SelectItem value="on_download">Trigger on Video Download</SelectItem>
              <SelectItem value="none">Disabled for this video</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving to Database...' : 'Save Ad Placements to Database'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
