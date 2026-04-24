# MaPaPis — Prototipo v0.1

Coordinador del grupo de padres del jardín/colegio.
Frontend-only, sin backend todavía. Datos mock.

## Qué tiene

- **Inicio**: lista de necesidades activas, stats rápidos, peek de rotación.
- **Nueva necesidad**: formulario con tipo (compra/votación/tarea) y sugerencia de rotación.
- **Detalle**: colecta con barra, tu parte + alias MP, presupuestos, estado de transferencias por familia.
- **Rotación**: ranking de familias con semáforo de color.

## Stack

- HTML + React 18 (UMD) + Tailwind CDN + Babel standalone — todo en un solo `index.html`.
- PWA instalable (manifest.json + sw.js + íconos).
- Mismo patrón que Studio PL / excursio / latefcasistencias.

## Estructura

```
MaPaPis/
├── deploy.py
└── github-pages/
    └── mapapis/
        ├── index.html
        ├── manifest.json
        ├── sw.js
        └── icons/
            ├── icon-192.png
            └── icon-512.png
```

## Correr local

Abrir `github-pages/mapapis/index.html` directo en el navegador. O servirlo:

```bash
cd github-pages/mapapis
python -m http.server 8080
```

## Deploy

```bash
# Crear repo en GitHub: tobcde/mapapis (activar GitHub Pages en branch main, carpeta /)
python deploy.py tobcde/mapapis ghp_xxxxx
```

URL final: `https://tobcde.github.io/mapapis/`

## Roadmap

- [ ] Backend Firebase (Auth + Firestore)
- [ ] CRUD de necesidades, presupuestos, transferencias
- [ ] Integración con Mercado Pago para colectas (link de pago)
- [ ] Bot de aviso al grupo de WhatsApp (webhook a número de contacto)
- [ ] Panel de delegados con permisos elevados
- [ ] Pantalla de votación completa
- [ ] **Marketplace**: pymes/empresas ven necesidades de los grupos, presentan oferta y se ocupan de hacer llegar el pedido
