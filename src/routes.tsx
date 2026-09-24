import type { ComponentType } from 'react';
import HomePage from './pages/HomePage';
import MusicPage from './pages/MusicPage';
import VideosPage from './pages/VideosPage';
import AwardsPage from './pages/AwardsPage';
import UploadPage from './pages/UploadPage';
import LibraryPage from './pages/LibraryPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SearchPage from './pages/SearchPage';
import TrendingPage from './pages/TrendingPage';
import MyDownloadsPage from './pages/MyDownloadsPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import SharedItemPage from './pages/SharedItemPage';
import ArtistPage from './pages/ArtistPage';
import ArtistsPage from './pages/ArtistsPage';
import SettingsPage from './pages/SettingsPage';
import BecomeArtistPage from './pages/BecomeArtistPage';
import PlansPage from './pages/PlansPage';
import StorePage from './pages/StorePage';
import MerchandisePage from './pages/MerchandisePage';
import CartPage from './pages/CartPage';

export interface RouteConfig {
  name: string;
  path: string;
  // Component reference — instantiated at render time, not module-load time,
  // so hooks inside pages only run after all providers have mounted.
  component: ComponentType;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Home',           path: '/',                component: HomePage,           public: true },
  { name: 'Music',          path: '/music',           component: MusicPage,          public: true },
  { name: 'Videos',         path: '/videos',          component: VideosPage,         public: true },
  { name: 'Awards',         path: '/awards',          component: AwardsPage,         public: true },
  { name: 'Trending',       path: '/trending',        component: TrendingPage,       public: true },
  { name: 'Artists',        path: '/artists',         component: ArtistsPage,        public: true },
  { name: 'Plans',          path: '/plans',           component: PlansPage,          public: true },
  { name: 'BecomeArtist',   path: '/become-artist',   component: BecomeArtistPage,   public: true },
  { name: 'Store',          path: '/store',           component: StorePage,          public: true },
  { name: 'Merchandise',    path: '/merchandise',     component: MerchandisePage,    public: true },
  { name: 'Cart',           path: '/cart',            component: CartPage,           public: true },
  { name: 'Search',         path: '/search',          component: SearchPage,         public: true },
  { name: 'PaymentSuccess', path: '/payment-success', component: PaymentSuccessPage, public: true },
  { name: 'Terms',          path: '/terms',           component: TermsPage,          public: true },
  { name: 'Privacy',        path: '/privacy',         component: PrivacyPage,        public: true },
  { name: 'SharedSong',     path: '/song/:id',        component: SharedItemPage,     public: true },
  { name: 'SharedSongs',    path: '/songs/:id',       component: SharedItemPage,     public: true },
  { name: 'SharedVideo',    path: '/video/:id',       component: SharedItemPage,     public: true },
  { name: 'SharedVideos',   path: '/videos/:id',      component: SharedItemPage,     public: true },
  { name: 'WatchVideo',     path: '/watch/:id',       component: SharedItemPage,     public: true },
  { name: 'ArtistDetail',   path: '/artist/:id',      component: ArtistPage,         public: true },
  { name: 'SharedNominee',  path: '/nominee/:id',     component: SharedItemPage,     public: true },
  { name: 'SharedNominees', path: '/nominees/:id',    component: SharedItemPage,     public: true },
  { name: 'Upload',         path: '/upload',          component: UploadPage,         public: false },
  { name: 'Library',        path: '/library',         component: LibraryPage,        public: false },
  { name: 'Downloads',      path: '/downloads',       component: MyDownloadsPage,    public: false },
  { name: 'Dashboard',      path: '/dashboard',       component: DashboardPage,      public: false },
  { name: 'Profile',        path: '/profile',         component: DashboardPage,      public: false },
  { name: 'Settings',       path: '/settings',        component: SettingsPage,       public: false },
  { name: 'Admin',          path: '/admin',           component: AdminPage,          public: false },
  { name: 'Login',          path: '/login',           component: LoginPage,          public: true },
  { name: 'Register',       path: '/register',        component: RegisterPage,       public: true },
  { name: 'ForgotPassword', path: '/forgot-password', component: ForgotPasswordPage, public: true },
  { name: 'ResetPassword',  path: '/reset-password',  component: ResetPasswordPage,  public: true },
];
