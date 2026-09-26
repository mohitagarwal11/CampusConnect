// Seed data for registrations, so the "My Registrations" and Organizer
// pages have something real to display before participants build the
// actual registration flow (Task 2 and Task 3).

import { getEventById, isPastEvent, isFullEvent } from "./events";
import { getUserById } from "./auth";

type RegistrationDebugDetails = Record<
  string,
  string | number | boolean | undefined
>;

function logRegistrationDebug(
  message: string,
  details: RegistrationDebugDetails,
) {
  const entry = { message, ...details };
  console.info(`[CampusConnect] ${message}`, entry);

  // Forward client-side registration activity to the Next dev server too.
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    void fetch("/api/debug/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Debug logging should never affect registration behavior.
    });
  }
}

export type RegistrationStatus = "confirmed" | "cancelled";

export type WaitlistStatus = "active" | "promoted" | "cancelled";

export interface Registration {
  id: string;
  eventId: string;
  studentId: string;
  status: RegistrationStatus;
  registeredAt: string; // ISO date string
}

export interface WaitlistEntry {
  id: string;
  eventId: string;
  studentId: string;
  status: WaitlistStatus;
  joinedAt: string;
  promotedAt?: string;
}

// NOTE FOR PARTICIPANTS: this array is the "database" of registrations.
// Task 2 (Registration) means pushing new items into this array when a
// student registers. Task 3 (Cancellation) means updating an item's
// status here. Keep using this same array — don't create a second store.
export const registrations: Registration[] = [
  {
    id: "reg-01",
    eventId: "evt-01",
    studentId: "stu-1",
    status: "confirmed",
    registeredAt: "2026-09-10T10:15:00",
  },
  {
    id: "reg-02",
    eventId: "evt-04",
    studentId: "stu-1",
    status: "confirmed",
    registeredAt: "2026-08-20T09:00:00",
  },
  {
    id: "reg-03",
    eventId: "evt-09",
    studentId: "stu-1",
    status: "confirmed",
    registeredAt: "2026-09-12T18:40:00",
  },
];

export const waitlistEntries: WaitlistEntry[] = [];

/** Simple lookup used by the placeholder "My Registrations" page. */
export function getRegistrationsForStudent(studentId: string): Registration[] {
  return registrations.filter((reg) => reg.studentId === studentId);
}

/** Check if a student is already registered for a given event. */
export function isStudentRegistered(
  studentId: string,
  eventId: string,
): boolean {
  return registrations.some(
    (reg) =>
      reg.eventId === eventId &&
      reg.studentId === studentId &&
      reg.status === "confirmed",
  );
}

export function getWaitlistForStudent(studentId: string): WaitlistEntry[] {
  return waitlistEntries.filter((entry) => entry.studentId === studentId);
}

export function isStudentOnWaitlist(
  studentId: string,
  eventId: string,
): boolean {
  return waitlistEntries.some(
    (entry) =>
      entry.eventId === eventId &&
      entry.studentId === studentId &&
      entry.status === "active",
  );
}

export function getWaitlistPosition(entry: WaitlistEntry): number {
  return (
    waitlistEntries
      .filter(
        (candidate) =>
          candidate.eventId === entry.eventId && candidate.status === "active",
      )
      .sort((first, second) => first.joinedAt.localeCompare(second.joinedAt))
      .findIndex((candidate) => candidate.id === entry.id) + 1
  );
}

export interface WaitlistResult {
  success: boolean;
  message: string;
  entry?: WaitlistEntry;
}

export function joinEventWaitlist(
  studentId: string,
  eventId: string,
): WaitlistResult {
  if (!studentId) {
    return {
      success: false,
      message: "Waitlist failed: You must be logged in.",
    };
  }

  const user = getUserById(studentId);
  if (!user || user.role !== "student") {
    return {
      success: false,
      message: "Waitlist failed: Only logged-in students can join a waitlist.",
    };
  }

  const event = getEventById(eventId);
  if (!event) {
    return { success: false, message: "Waitlist failed: Event not found." };
  }

  if (event.cancelled) {
    return {
      success: false,
      message: "Waitlist failed: This event is cancelled.",
    };
  }

  if (isPastEvent(event)) {
    return {
      success: false,
      message: "Waitlist failed: This event has already ended.",
    };
  }

  if (
    event.registrationDeadline &&
    new Date(event.registrationDeadline).getTime() <= Date.now()
  ) {
    return {
      success: false,
      message: "Waitlist failed: The registration period has closed.",
    };
  }

  if (!isFullEvent(event)) {
    return {
      success: false,
      message: "Waitlist failed: This event still has available seats.",
    };
  }

  if (isStudentRegistered(studentId, eventId)) {
    return {
      success: false,
      message: "Waitlist failed: You are already registered.",
    };
  }

  if (isStudentOnWaitlist(studentId, eventId)) {
    return {
      success: false,
      message: "Waitlist failed: You are already on the waitlist.",
    };
  }

  const entry: WaitlistEntry = {
    id: `wait-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventId,
    studentId,
    status: "active",
    joinedAt: new Date().toISOString(),
  };
  waitlistEntries.push(entry);

  return {
    success: true,
    message: `You joined the waitlist for ${event.name}.`,
    entry,
  };
}

export function cancelWaitlistEntry(
  entryId: string,
  studentId: string,
): WaitlistResult {
  const entry = waitlistEntries.find((candidate) => candidate.id === entryId);
  if (!entry) return { success: false, message: "Waitlist entry not found." };
  if (entry.studentId !== studentId)
    return { success: false, message: "Unauthorized action." };
  if (entry.status !== "active") {
    return {
      success: false,
      message: "This waitlist entry is no longer active.",
    };
  }

  entry.status = "cancelled";
  return { success: true, message: "You left the event waitlist.", entry };
}

function promoteNextWaitlistedStudent(
  eventId: string,
): WaitlistEntry | undefined {
  const nextEntry = waitlistEntries
    .filter((entry) => entry.eventId === eventId && entry.status === "active")
    .sort((first, second) => first.joinedAt.localeCompare(second.joinedAt))[0];

  if (!nextEntry) return undefined;

  const promotedAt = new Date().toISOString();
  nextEntry.status = "promoted";
  nextEntry.promotedAt = promotedAt;
  registrations.push({
    id: `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventId,
    studentId: nextEntry.studentId,
    status: "confirmed",
    registeredAt: promotedAt,
  });
  return nextEntry;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  registration?: Registration;
}

/**
 * Register a student for an event while enforcing all validation rules:
 * - Requires login & student role
 * - Blocks registration for past or cancelled events
 * - Prevents registration when event is full
 * - Prevents duplicate registrations
 * - Decreases available seats upon success
 */
export function registerStudentForEvent(
  studentId: string,
  eventId: string,
): RegisterResult {
  if (!studentId) {
    return {
      success: false,
      message: "Registration failed: You must be logged in to register.",
    };
  }

  const user = getUserById(studentId);
  if (!user || user.role !== "student") {
    return {
      success: false,
      message:
        "Registration failed: Only logged-in students can register for events. Please switch to a student account.",
    };
  }

  const event = getEventById(eventId);
  if (!event) {
    return {
      success: false,
      message: "Registration failed: Event not found.",
    };
  }

  if (event.cancelled) {
    return {
      success: false,
      message:
        "Registration failed: This event has been cancelled by the organizer.",
    };
  }

  if (isPastEvent(event)) {
    return {
      success: false,
      message: "Registration failed: Registration is closed for past events.",
    };
  }

  if (
    event.registrationDeadline &&
    new Date(event.registrationDeadline).getTime() <= Date.now()
  ) {
    return {
      success: false,
      message: "Registration failed: The registration period has closed.",
    };
  }

  if (isFullEvent(event)) {
    return {
      success: false,
      message: "Registration failed: This event is already full.",
    };
  }

  if (isStudentRegistered(studentId, eventId)) {
    logRegistrationDebug("Duplicate registration blocked", {
      eventId,
      studentId,
    });
    return {
      success: false,
      message:
        "Registration failed: You are already registered for this event.",
    };
  }

  // Create registration & decrement seats
  const newRegistration: Registration = {
    id: `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventId,
    studentId,
    status: "confirmed",
    registeredAt: new Date().toISOString(),
  };

  registrations.push(newRegistration);
  const seatsBefore = event.seatsAvailable;
  event.seatsAvailable = Math.max(0, event.seatsAvailable - 1);
  logRegistrationDebug("Seat count updated after registration", {
    eventId,
    studentId,
    seatsBefore,
    seatsAfter: event.seatsAvailable,
    registeredCount: event.capacity - event.seatsAvailable,
  });

  return {
    success: true,
    message: `Successfully registered for ${event.name}!`,
    registration: newRegistration,
  };
}

export interface CancelResult {
  success: boolean;
  message: string;
}

/**
 * Cancel a student registration (Task 3):
 * - Sets status to 'cancelled'
 * - Increases available seats by 1 if it was confirmed
 */
export function cancelRegistration(
  registrationId: string,
  studentId: string,
): CancelResult {
  const reg = registrations.find((r) => r.id === registrationId);
  if (!reg) {
    return { success: false, message: "Registration not found." };
  }

  if (reg.studentId !== studentId) {
    return { success: false, message: "Unauthorized action." };
  }

  if (reg.status === "cancelled") {
    return { success: false, message: "Registration is already cancelled." };
  }

  // Update registration status to cancelled
  const event = getEventById(reg.eventId);
  const seatsBefore = event?.seatsAvailable;
  reg.status = "cancelled";

  // Increase available seats safely
  if (event) {
    const promotedEntry = promoteNextWaitlistedStudent(reg.eventId);
    if (promotedEntry) {
      logRegistrationDebug("Waitlisted student promoted after cancellation", {
        eventId: reg.eventId,
        registrationId,
        promotedStudentId: promotedEntry.studentId,
      });
    } else {
      event.seatsAvailable = Math.min(event.capacity, event.seatsAvailable + 1);
    }
    logRegistrationDebug("Seat count updated after cancellation", {
      eventId: reg.eventId,
      registrationId,
      studentId,
      seatsBefore,
      seatsAfter: event.seatsAvailable,
      registrationStatus: reg.status,
    });
  } else {
    logRegistrationDebug("Registration cancelled but event was not found", {
      eventId: reg.eventId,
      registrationId,
      studentId,
      registrationStatus: reg.status,
    });
  }

  return {
    success: true,
    message: "Registration successfully cancelled.",
  };
}
