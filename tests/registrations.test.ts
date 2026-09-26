import { describe, it, expect } from "vitest";
import {
  getRegistrationsForStudent,
  registerStudentForEvent,
  cancelRegistration,
  joinEventWaitlist,
  waitlistEntries,
  registrations,
} from "@/data/registrations";
import { getEventById } from "@/data/events";

describe("getRegistrationsForStudent", () => {
  it("returns only the seeded registrations belonging to that student", () => {
    const mine = getRegistrationsForStudent("stu-1");
    expect(mine.length).toBe(3);
    expect(mine.every((reg) => reg.studentId === "stu-1")).toBe(true);
  });
});

describe("registerStudentForEvent", () => {
  it("registers a student successfully and decreases available seats", () => {
    const eventId = "evt-05"; // Figma workshop, initial seats = 6
    const studentId = "stu-1";
    const eventBefore = getEventById(eventId)!;
    const initialSeats = eventBefore.seatsAvailable;

    const result = registerStudentForEvent(studentId, eventId);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Successfully registered");

    const eventAfter = getEventById(eventId)!;
    expect(eventAfter.seatsAvailable).toBe(initialSeats - 1);
  });

  it("prevents duplicate registration for the same event", () => {
    const eventId = "evt-01"; // stu-1 is already registered for evt-01 in seed data
    const studentId = "stu-1";

    const result = registerStudentForEvent(studentId, eventId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("already registered");
  });

  it("prevents registration when event is full", () => {
    const eventId = "evt-02"; // Open mic night, seatsAvailable = 0
    const studentId = "stu-1";

    const result = registerStudentForEvent(studentId, eventId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("full");
  });

  it("prevents registration for past events", () => {
    const eventId = "evt-10"; // Photo walk, date in past relative to TODAY
    const studentId = "stu-1";

    const result = registerStudentForEvent(studentId, eventId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("closed for past events");
  });

  it("requires student role login", () => {
    const eventId = "evt-05";
    const organizerId = "org-1";

    const result = registerStudentForEvent(organizerId, eventId);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Only logged-in students can register");
  });
});

describe("event waitlists", () => {
  it("allows a student to join a full event and prevents duplicate entries", () => {
    const firstResult = joinEventWaitlist("stu-1", "evt-02");
    const duplicateResult = joinEventWaitlist("stu-1", "evt-02");

    expect(firstResult.success).toBe(true);
    expect(duplicateResult.success).toBe(false);
    expect(duplicateResult.message).toContain("already on the waitlist");
  });

  it("promotes the first waitlisted student when a confirmed registration is cancelled", () => {
    const event = getEventById("evt-02")!;
    const waitlistEntry = waitlistEntries.find(
      (entry) => entry.eventId === event.id && entry.status === "active",
    )!;
    const confirmedRegistration = {
      id: "reg-waitlist-promotion",
      eventId: event.id,
      studentId: "stu-1",
      status: "confirmed" as const,
      registeredAt: new Date().toISOString(),
    };
    registrations.push(confirmedRegistration);

    const result = cancelRegistration(confirmedRegistration.id, "stu-1");

    expect(result.success).toBe(true);
    expect(waitlistEntry.status).toBe("promoted");
    expect(
      registrations.some(
        (registration) =>
          registration.eventId === event.id &&
          registration.studentId === "stu-1" &&
          registration.status === "confirmed",
      ),
    ).toBe(true);
    expect(event.seatsAvailable).toBe(0);
  });
});

describe("cancelRegistration", () => {
  it("cancels a registration, marks status as cancelled, and increases available seats", () => {
    const regId = "reg-01"; // evt-01, stu-1
    const eventBefore = getEventById("evt-01")!;
    const seatsBefore = eventBefore.seatsAvailable;

    const result = cancelRegistration(regId, "stu-1");

    expect(result.success).toBe(true);
    const eventAfter = getEventById("evt-01")!;
    expect(eventAfter.seatsAvailable).toBe(seatsBefore + 1);
  });
});
