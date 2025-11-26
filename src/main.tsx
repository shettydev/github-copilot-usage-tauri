import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayProvider } from './contexts/TrayContext';
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { TrayIcon } from "@tauri-apps/api/tray";
import { invoke } from "@tauri-apps/api/core";

(async () => {
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

  // const icon = await defaultWindowIcon();
  const options = {
    id: 'main',
    title: 'GitHub Copilot Usage',
    menu,
    menuOnLeftClick: true,
    // ...(icon ? { icon } : {}),
  };

  const tray = await TrayIcon.new(options);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <TrayProvider tray={tray}>
        <App />
      </TrayProvider>
    </React.StrictMode>,
  );
})();