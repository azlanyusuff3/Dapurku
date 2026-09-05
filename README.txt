DAPURKU v1 - OFFLINE-FIRST PWA

Cara cuba paling mudah:
1. Upload semua fail/folder dalam folder DapurKu_v1 ke GitHub repo.
2. Enable GitHub Pages (Settings > Pages > Deploy from branch > main / root).
3. Buka URL Pages di Safari/Chrome.
4. iPhone/iPad: Share > Add to Home Screen.
5. Android/Chrome: menu > Install app / Add to Home screen.

Data disimpan local dalam browser menggunakan IndexedDB. Export Backup dalam tab More untuk backup JSON.

Nota barcode:
- Scanner kamera cuba guna BarcodeDetector API jika browser menyokongnya.
- Jika browser tak support, field barcode masih boleh diisi manual. Ini sengaja dibuat tanpa external CDN supaya PWA kekal offline selepas install.

Nota resepi Che Nom:
- DapurKu v1 tidak menyalin penuh kandungan resepi pihak ketiga.
- Library demo fokus pada ingredient planning / pantry matching dan menyediakan pautan sumber rasmi bila berkaitan.
