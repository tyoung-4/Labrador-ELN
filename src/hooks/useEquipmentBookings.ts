"use client";

import { useCallback, useEffect, useState } from "react";
import { ALL_RESOURCES } from "@/components/EquipmentShared";
import type { ScheduleEvent, BookingDraft, ResourceId } from "@/components/EquipmentShared";

/**
 * Shared hook for API-backed equipment bookings.
 * Used by EquipmentCalendar (dashboard) and the full /equipment page.
 * Fetches all bookings on mount and polls every 30 s.
 */
export function useEquipmentBookings() {
  const [events,  setEvents]  = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/equipment-bookings");
      if (res.ok) {
        const data: ScheduleEvent[] = await res.json();
        setEvents(data);
      }
    } catch { /* network offline — keep stale data */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  /**
   * Create or update a booking via the API.
   * Returns null on success, or an error message string on failure.
   */
  async function saveBooking(
    draft: BookingDraft,
    editEventId: string | null,
    userId: string,
    userName: string
  ): Promise<string | null> {
    if (!draft.resourceId || !draft.date || !draft.startTime || !draft.endTime) {
      return "Please fill in all required fields.";
    }

    const autoTitle =
      draft.title.trim() ||
      (ALL_RESOURCES.find(r => r.id === draft.resourceId)?.label ?? draft.resourceId);

    const payload = {
      equipmentId:  draft.resourceId,
      operatorName: userName,
      userId,
      startTime:    `${draft.date}T${draft.startTime}:00`,
      endTime:      `${draft.date}T${draft.endTime}:00`,
      title:        autoTitle,
    };

    const url    = editEventId ? `/api/equipment-bookings/${editEventId}` : "/api/equipment-bookings";
    const method = editEventId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        return body.error ?? "Failed to save booking.";
      }

      await refresh();
      return null;
    } catch {
      return "Network error — please try again.";
    }
  }

  /** Delete a booking by id. */
  async function deleteBooking(id: string): Promise<void> {
    try {
      await fetch(`/api/equipment-bookings/${id}`, { method: "DELETE" });
      await refresh();
    } catch { /* ignore */ }
  }

  return { events, loading, refresh, saveBooking, deleteBooking };
}

/** Helper: given a ResourceId and events list, checks if the userId owns an event */
export function canUserDelete(event: ScheduleEvent, userId: string): boolean {
  return event.userId === userId;
}
