import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayProvider } from './contexts/TrayContext';
import { ProviderProvider } from './contexts/ProviderContext';
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { invoke } from "@tauri-apps/api/core";
import { runMigrations } from './services/migration';

(async () => {
  runMigrations();

  const menu = await Menu.new({
    items: [
      {
        id: 'show',
        text: 'Show App',
        action: () => {
          invoke('show_window');
        },
      },
      {
        id: 'quit',
        text: 'Quit',
        action: () => {
          invoke('close_app');
        },
      },
    ],
  });

  const options = {
    id: 'main',
    title: 'AI Usage',
    menu,
    menuOnLeftClick: true,
  };

  const tray = await TrayIcon.new(options);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <TrayProvider tray={tray}>
        <ProviderProvider>
          <App />
        </ProviderProvider>
      </TrayProvider>
    </React.StrictMode>,
  );
})();
