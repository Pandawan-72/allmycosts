import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { storage } from "@/src/utils/storage";

const ENABLED_KEY = "amc.notif.enabled";
const DAYS_KEY = "amc.notif.daysBefore";

export const NotificationsHelper = {
  async getEnabled(): Promise<boolean> {
    return await storage.getItem<boolean>(ENABLED_KEY, false);
  },
  async setEnabled(v: boolean) {
    await storage.setItem(ENABLED_KEY, v);
  },
  async getDaysBefore(): Promise<number> {
    return await storage.getItem<number>(DAYS_KEY, 1);
  },
  async setDaysBefore(d: number) {
    await storage.setItem(DAYS_KEY, d);
  },
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") return true;
      const { status: next } = await Notifications.requestPermissionsAsync();
      return next === "granted";
    } catch {
      return false;
    }
  },
  async scheduleFor(subId: string, subName: string, dueDateIso: string, daysBefore: number) {
    if (Platform.OS === "web") return null;
    try {
      const due = new Date(dueDateIso);
      const trigger = new Date(due.getTime() - daysBefore * 86400000);
      trigger.setHours(9, 0, 0, 0);
      if (trigger.getTime() <= Date.now()) return null;
      const id = await Notifications.scheduleNotificationAsync({
        identifier: `amc-${subId}`,
        content: { title: subName, body: `Paiement dans ${daysBefore} jour(s)` },
        trigger,
      });
      return id;
    } catch {
      return null;
    }
  },
  async cancel(subId: string) {
    if (Platform.OS === "web") return;
    try {
      await Notifications.cancelScheduledNotificationAsync(`amc-${subId}`);
    } catch {}
  },
};
