import { useEffect, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getAllDownloads } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Download as DownloadType } from '@/types/index';

export default function AdminDownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    getAllDownloads()
      .then(setDownloads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = downloads.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.artist_name.toLowerCase().includes(q);
    const matchType   = typeFilter === 'all' || d.content_type === typeFilter;
    return matchSearch && matchType;
  });

  const exportCsv = () => {
    const rows = [
      ['Date', 'Title', 'Artist', 'Type', 'User ID'],
      ...filtered.map(d => [formatDate(d.downloaded_at), d.title, d.artist_name, d.content_type, d.user_id]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'downloads.csv'; a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Downloads</h1>
          <p className="text-sm text-muted-foreground">{downloads.length} total download records</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />Export CSV
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search title or artist…" className="pl-9 h-8 text-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-sm w-32"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="song">Songs</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Title', 'Artist', 'Type', 'User', 'Date'].map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td colSpan={5} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td>
              </tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-muted-foreground text-xs">No downloads found</td></tr>
            ) : filtered.slice(0, 200).map(d => (
              <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                <td className="py-2.5 px-3 whitespace-nowrap max-w-[160px] truncate font-medium">{d.title}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{d.artist_name}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <Badge variant="outline" className="text-[10px] capitalize">{d.content_type}</Badge>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs font-mono">{d.user_id?.slice(0, 8)}…</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(d.downloaded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing {Math.min(filtered.length, 200)} of {filtered.length} records</p>
    </div>
  );
}
