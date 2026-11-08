import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'admin/licenses', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
