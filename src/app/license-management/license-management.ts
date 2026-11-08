import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';

interface License {
  id: string; clinicName: string; installationId: string; productId: string;
  environment: string | null; isActive: boolean; expiresAt: string; lastSeenAt: string | null; revision: number;
}
interface Credentials { license: License; installationSecret: string }
interface SigningKey { keyId: string; publicKey: string }

@Component({
  selector: 'app-license-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './license-management.html',
  styleUrl: './license-management.css',
})
export class LicenseManagement {
  readonly ready = signal(false);
  readonly configured = signal(false);
  readonly authenticated = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly licenses = signal<License[]>([]);
  readonly credentials = signal<Credentials | null>(null);
  readonly signingKey = signal<SigningKey | null>(null);
  readonly editing = signal<License | null>(null);
  readonly rotating = signal<License | null>(null);
  readonly query = signal('');
  readonly filter = signal('all');
  readonly visible = computed(() => this.licenses().filter(x =>
    `${x.clinicName} ${x.installationId} ${x.productId} ${x.environment ?? ''}`.toLocaleLowerCase().includes(this.query().trim().toLocaleLowerCase()) &&
    (this.filter() === 'all' || this.state(x) === this.filter())));
  readonly activeCount = computed(() => this.licenses().filter(x => this.state(x) === 'active').length);
  key = '';
  serverUrl = '';
  create = { clinicName: '', productId: 'dental-clinic', environment: 'Production', expiresAt: this.defaultExpiry() };
  edit = { isActive: true, expiresAt: '' };

  constructor() {
    inject(Title).setTitle('مدیریت لایسنس‌ها | امیرحسین مکینه');
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => void this.initialize());
  }
  private defaultExpiry() { return this.localDate(new Date(Date.now() + 30 * 86400000).toISOString()); }
  localDate(iso: string) {
    const value = new Date(iso);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  state(license: License): string {
    if (!license.isActive) return 'disabled';
    return new Date(license.expiresAt).getTime() <= Date.now() ? 'expired' : 'active';
  }
  stateLabel(license: License) { return ({ active: 'فعال', disabled: 'غیرفعال', expired: 'منقضی' } as Record<string, string>)[this.state(license)]; }
  date(iso: string | null) { return iso ? new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : 'هنوز متصل نشده'; }
  private clearPrivateState() {
    this.authenticated.set(false); this.licenses.set([]); this.credentials.set(null);
    this.signingKey.set(null); this.editing.set(null); this.rotating.set(null); this.serverUrl = '';
  }
  private async request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
    const response = await fetch(`/api/license-management${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-License-Management': '1' },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401) this.clearPrivateState();
    const value = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(value?.error ?? 'درخواست انجام نشد؛ دوباره تلاش کنید.');
    return value as T;
  }
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await action(); }
    catch (e) { this.error.set(e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'TypeError' ? e.message : 'ارتباط برقرار نشد؛ اتصال اینترنت و سرویس را بررسی کنید.'); }
    finally { this.busy.set(false); }
  }
  async initialize() {
    await this.run(async () => {
      const session = await this.request<{ configured: boolean; authenticated: boolean; serverUrl?: string }>('/session');
      this.configured.set(session.configured); this.authenticated.set(session.authenticated); this.serverUrl = session.serverUrl ?? '';
      if (session.authenticated) await this.load();
    });
    this.ready.set(true);
  }
  async login() {
    const key = this.key; this.key = '';
    await this.run(async () => {
      const session = await this.request<{ serverUrl: string }>('/login', 'POST', { key });
      this.serverUrl = session.serverUrl; this.authenticated.set(true); await this.load();
    });
  }
  async logout() { await this.run(async () => { await this.request('/logout', 'POST'); this.clearPrivateState(); }); }
  private async load() { this.licenses.set(await this.request<License[]>('/licenses')); }
  async refresh() { await this.run(() => this.load()); }
  async createLicense() {
    await this.run(async () => {
      this.credentials.set(null);
      const value = await this.request<Credentials>('/licenses', 'POST', {
        ...this.create, clinicName: this.create.clinicName.trim(), productId: this.create.productId.trim(),
        environment: this.create.environment.trim() || null, expiresAt: new Date(this.create.expiresAt).toISOString(),
      });
      this.credentials.set(value); this.create.clinicName = ''; await this.load();
      this.notice.set('لایسنس ساخته شد. رمز نصب را قبل از بستن این بخش نگه دارید.');
    });
  }
  beginEdit(license: License) {
    this.edit = { isActive: license.isActive, expiresAt: this.localDate(license.expiresAt) }; this.editing.set(license);
  }
  async save() {
    const license = this.editing(); if (!license) return;
    await this.run(async () => {
      await this.request(`/licenses/${license.id}`, 'PUT', {
        isActive: this.edit.isActive, expiresAt: new Date(this.edit.expiresAt).toISOString(), revision: license.revision,
      });
      this.editing.set(null); await this.load(); this.notice.set('ذخیره شد؛ تغییر در بررسی بعدی کلینیک اعمال می‌شود.');
    });
  }
  async rotate() {
    const license = this.rotating(); if (!license) return;
    await this.run(async () => {
      this.credentials.set(null);
      this.credentials.set(await this.request<Credentials>(`/licenses/${license.id}/rotate-secret`, 'POST'));
      this.rotating.set(null); await this.load(); this.notice.set('رمز جدید آماده است؛ آن را در تنظیمات کلینیک جایگزین کنید.');
    });
  }
  async showPublicKey() { await this.run(async () => this.signingKey.set(await this.request<SigningKey>('/signing-key'))); }
  configText() {
    const value = this.credentials(); if (!value) return '';
    return JSON.stringify({ License: {
      ServerUrl: this.serverUrl, InstallationId: value.license.installationId,
      ProductId: value.license.productId, Environment: value.license.environment,
      InstallationSecret: value.installationSecret,
    } }, null, 2);
  }
  publicKeyText() {
    const value = this.signingKey();
    return value ? JSON.stringify({ License: { PublicKeys: { [value.keyId]: value.publicKey } } }, null, 2) : '';
  }
  async copy(text: string) {
    try { await navigator.clipboard.writeText(text); this.notice.set('کپی شد.'); }
    catch { this.error.set('کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کنید.'); }
  }
}
