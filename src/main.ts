import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  console.error(err);
  const root = document.querySelector('app-root');
  if (root) {
    root.innerHTML = `
      <div style="max-width:640px;margin:12vh auto;padding:24px;font-family:Inter,system-ui,sans-serif;color:#e2e8f0">
        <h1 style="color:#fb7185;font-size:20px;margin:0 0 8px">The app failed to start</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 12px">
          Open the browser console for details. Common fixes: stop the dev server,
          delete <code>.angular/cache</code>, and run <code>npm start</code> again.
        </p>
        <pre style="white-space:pre-wrap;background:#0f141c;border:1px solid #1f2937;border-radius:8px;padding:12px;font-size:12px;color:#cbd5e1">${
          String((err && (err.stack || err.message)) || err).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
        }</pre>
      </div>`;
  }
});
