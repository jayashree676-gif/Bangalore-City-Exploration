# 3D City — Three.js

A procedurally generated low-poly city you can walk and drive through, built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).

## Features
- Procedurally generated city grid: roads, lane markings, varied building heights/colors, plazas, streetlights
- First-person walk mode with pointer-lock mouse look, sprint, jump, and building collision
- Drivable car with simple acceleration/braking/turning physics and collision against buildings
- Minimap showing your position and the car's position relative to the city layout
- Shadow-mapped sun light, fog, and ACES tone mapping for a polished look

## Controls
- Click the screen to lock the mouse and start
- `WASD` / arrow keys — move or drive
- `Shift` — sprint (walking)
- `Space` — jump (walking) / brake (driving)
- `F` — enter the car when nearby, or exit it
- `Esc` — release the mouse

## Running locally
```bash
npm install
npm run dev
```
Then open the printed local URL (default `http://localhost:5173`).

## Building for production
```bash
npm run build
npm run preview
```
Output goes to `dist/`. The app is a static site, so `dist/` can be deployed to GitHub Pages, Vercel, Netlify, or any static host.

## Project structure
```
index.html        entry HTML + HUD markup/styles
src/main.js        renderer, camera, input, game loop
src/city.js        procedural city generator (roads, buildings, streetlights)
src/car.js         low-poly car model + drive physics
```
