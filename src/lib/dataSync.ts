import { supabase } from '@/lib/supabase';
import type { Song, Video, Profile, Nominee, Vote, Like, Download } from '@/types';

export const dataSync = {
  // MUSIC
  getSongs: async (): Promise<Song[]> => {
    const { data } = await supabase.from('songs').select('*');
    return data || [];
  },

  // VIDEOS
  getVideos: async (): Promise<Video[]> => {
    const { data } = await supabase.from('videos').select('*');
    return data || [];
  },

  // USERS & ADMINS
  getUsers: async (): Promise<Profile[]> => {
    const { data } = await supabase.from('profiles').select('*');
    return data || [];
  },
  getAdmins: async (): Promise<Profile[]> => {
    const { data } = await supabase.from('profiles').select('*').in('role', ['admin', 'super_admin']);
    return data || [];
  },

  // AWARDS & NOMINEES
  getNominees: async (): Promise<Nominee[]> => {
    const { data } = await supabase.from('nominees').select('*');
    return data || [];
  },

  // VOTES
  getVotes: async (): Promise<Vote[]> => {
    const { data } = await supabase.from('votes').select('*');
    return data || [];
  },

  // PLAYS
  getPlays: async () => {
    const { data } = await supabase.from('plays').select('*');
    return data || [];
  },

  // LIKES
  getLikes: async (): Promise<Like[]> => {
    const { data } = await supabase.from('likes').select('*');
    return data || [];
  },

  // DOWNLOADS
  getDownloads: async (): Promise<Download[]> => {
    const { data } = await supabase.from('downloads').select('*');
    return data || [];
  },
};
