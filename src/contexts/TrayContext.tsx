import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu, MenuItemOptions, PredefinedMenuItemOptions, CheckMenuItemOptions } from '@tauri-apps/api/menu';
import { invoke } from '@tauri-apps/api/core';

type UsageInfo = {
  premiumUsed: number;
  premiumLimit: number;
  premiumRemaining: number;
};

type TrayContextType = {
  setText: (text?: string) => Promise<void>;
  close: () => Promise<void>;
  tray: TrayIcon | null;
  updateMenu: (usage: UsageInfo | null, onRefresh?: () => void) => Promise<void>;
};

const TrayContext = createContext<TrayContextType | null>(null);

export const useTray = (): TrayContextType => {
  const ctx = useContext(TrayContext);
  if (!ctx) throw new Error('useTray must be used within a TrayProvider');
  return ctx;
};

export const TrayProvider: React.FC<{ tray: TrayIcon | null; children?: React.ReactNode }> = ({ tray, children }) => {
  const [autostartEnabled, setAutostartEnabled] = useState(false);

  useEffect(() => {
    const checkAutostart = async () => {
      try {
        const enabled = await invoke<boolean>('is_autostart_enabled');
        setAutostartEnabled(enabled);
      } catch (e) {
        console.debug('Failed to check autostart status:', e);
      }
    };
    checkAutostart();
  }, []);

  const toggleAutostart = useCallback(async () => {
    try {
      if (autostartEnabled) {
        await invoke('disable_autostart');
        setAutostartEnabled(false);
      } else {
        await invoke('enable_autostart');
        setAutostartEnabled(true);
      }
    } catch (e) {
      console.error('Failed to toggle autostart:', e);
    }
  }, [autostartEnabled]);

  const setText = useCallback(async (text?: string) => {
    try {
      if (tray) {
        await tray.setTitle(text ?? '');
        await tray.setTooltip(`GitHub Copilot Usage${text ? ` - ${text}` : ''}`);
      } else {
        // fallback: try to find the tray by id
        const found = await TrayIcon.getById('main');
        await found?.setTitle(text ?? '');
        await found?.setTooltip(`GitHub Copilot Usage${text ? ` - ${text}` : ''}`);
      }
    } catch (e) {
      // ignore errors when running on platforms that don't support titles
      console.debug('setText error', e);
    }
  }, [tray]);

  const close = useCallback(async () => {
    const found = await TrayIcon.getById('main');
    found?.close();
  }, []);

  const updateMenu = useCallback(async (usage: UsageInfo | null, onRefresh?: () => void) => {
    try {
      const targetTray = tray ?? await TrayIcon.getById('main');
      if (!targetTray) return;

      const items: Array<MenuItemOptions | PredefinedMenuItemOptions | CheckMenuItemOptions> = [];

      if (usage) {
        items.push(
          {
            id: 'usage_header',
            text: 'Premium Requests',
            enabled: false,
          },
          {
            id: 'usage_used',
            text: `  Used: ${usage.premiumUsed} / ${usage.premiumLimit}`,
            enabled: false,
          },
          {
            id: 'usage_remaining',
            text: `  Remaining: ${usage.premiumRemaining}`,
            enabled: false,
          },
          {
            item: 'Separator',
          }
        );
      }

      items.push(
        {
          id: 'refresh',
          text: 'Refresh Now',
          action: onRefresh ?? (() => {}),
        },
        {
          item: 'Separator',
        },
        {
          id: 'show',
          text: 'Show App',
          action: () => {
            invoke('show_window');
          },
        },
        {
          item: 'Separator',
        },
        {
          id: 'autostart',
          text: 'Start at Login',
          checked: autostartEnabled,
          action: toggleAutostart,
        } as CheckMenuItemOptions,
        {
          item: 'Separator',
        },
        {
          id: 'quit',
          text: 'Quit',
          action: () => {
            invoke('close_app');
          },
        }
      );

      const menu = await Menu.new({ items });
      await targetTray.setMenu(menu);
    } catch (e) {
      console.debug('Failed to update tray menu:', e);
    }
  }, [tray, autostartEnabled, toggleAutostart]);

  useEffect(() => {
    invoke('set_tray_icon');
  }, []);

  return (
    <TrayContext.Provider value={{ setText, close, tray, updateMenu }}>
      {children}
    </TrayContext.Provider>
  );
};

export default TrayContext;
