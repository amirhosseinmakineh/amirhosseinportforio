import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home').then(m => m.Home) },
  { path: 'admin/licenses', loadComponent: () => import('./license-management/license-management').then(m => m.LicenseManagement) },
  { path: '**', redirectTo: '' },
];
