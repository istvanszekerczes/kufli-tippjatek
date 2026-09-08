import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * Web Push opt-in. Registers this device's push subscription against the
 * signed-in user so the `notify-missing-picks` job can reach them.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly sb = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  readonly permission = signal<NotificationPermission>(
    this.supported ? Notification.permission : 'denied'
  );
  readonly enabled = signal(false); // this device has an active subscription
  readonly busy = signal(false);

  /** Reflect the current subscription state (call once the user is known). */
  async refresh(): Promise<void> {
    if (!this.supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      this.enabled.set(!!sub);
      this.permission.set(Notification.permission);
    } catch {
      this.enabled.set(false);
    }
  }

  async enable(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.supported) return { ok: false, reason: 'unsupported' };
    if (!this.auth.user()) return { ok: false, reason: 'signed-out' };
    this.busy.set(true);
    try {
      const perm = await Notification.requestPermission();
      this.permission.set(perm);
      if (perm !== 'granted') return { ok: false, reason: perm };

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToU8(environment.vapidPublicKey) as BufferSource
        });
      }

      const keys = sub.toJSON().keys ?? {};
      const { error } = await this.sb.client.from('push_subscriptions').upsert(
        {
          user_id: this.auth.user()!.id,
          endpoint: sub.endpoint,
          p256dh: keys['p256dh'] ?? '',
          auth: keys['auth'] ?? '',
          user_agent: navigator.userAgent.slice(0, 200),
          last_seen: new Date().toISOString()
        },
        { onConflict: 'endpoint' }
      );
      if (error) throw error;

      this.enabled.set(true);
      // immediate confirmation so the user sees it works
      try {
        await reg.showNotification('Kufli TippJáték', {
          body: 'Értesítések bekapcsolva – szólunk, ha lemaradnál egy tippel.',
          icon: '/kufli-logo-192.png',
          tag: 'kufli-enabled'
        });
      } catch {
        /* not fatal */
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? 'error' };
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (!this.supported) return;
    this.busy.set(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await this.sb.client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      this.enabled.set(false);
    } finally {
      this.busy.set(false);
    }
  }
}

function urlB64ToU8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
