"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  cancelEvent,
  CampusEvent,
  createEvent,
  EventCategory,
  EventInput,
  events,
  isRegistrationClosed,
  updateEvent,
  validateEventInput,
} from "@/data/events";
import { getUserById } from "@/data/auth";
import { registrations } from "@/data/registrations";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

const CATEGORIES: EventCategory[] = [
  "Tech",
  "Cultural",
  "Sports",
  "Workshop",
  "Career",
  "Music",
];
const EMPTY_FORM: EventInput = {
  name: "",
  description: "",
  date: "",
  registrationDeadline: "",
  venue: "",
  category: "Tech",
  capacity: 1,
};

function toLocalInputValue(date: string) {
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export default function OrganizerPage() {
  const { currentUser } = useAuth();
  const [, setRevision] = useState(0);
  const [form, setForm] = useState<EventInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  if (currentUser.role !== "organizer") {
    return (
      <section className="shell" style={{ padding: "56px 0" }}>
        <EmptyState
          title="This page is for organizers"
          description="Switch to an organizer account from the top-right menu to manage events."
        />
      </section>
    );
  }

  const myEvents = events.filter(
    (event) => event.organizerId === currentUser.id,
  );
  const selectedEvent = myEvents.find((event) => event.id === selectedEventId);

  function startCreate() {
    setIsFormOpen(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setNotice("");
  }

  function startEdit(event: CampusEvent) {
    setIsFormOpen(true);
    setSelectedEventId(null);
    setEditingId(event.id);
    setForm({
      name: event.name,
      description: event.description,
      date: toLocalInputValue(event.date),
      registrationDeadline: event.registrationDeadline
        ? toLocalInputValue(event.registrationDeadline)
        : "",
      venue: event.venue,
      category: event.category,
      capacity: event.capacity,
    });
    setFormError("");
    setNotice("");
  }

  function submitEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const existing = editingId
      ? events.find((event) => event.id === editingId)
      : undefined;
    const occupied = existing ? existing.capacity - existing.seatsAvailable : 0;
    const validationError = validateEventInput(form, occupied);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (editingId) updateEvent(editingId, form);
    else createEvent(form, currentUser.id);
    setRevision((revision) => revision + 1);
    setFormError("");
    setNotice(editingId ? "Event updated." : "Event created.");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
  }

  function openEventDetails(event: CampusEvent) {
    setSelectedEventId(event.id);
    setNotice("");
  }

  function handleEventRowKeyDown(
    event: KeyboardEvent<HTMLLIElement>,
    campusEvent: CampusEvent,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEventDetails(campusEvent);
    }
  }

  function handleCancel(event: CampusEvent) {
    if (
      event.cancelled ||
      !window.confirm(
        `Cancel “${event.name}”? Students will no longer see it or its registrations.`,
      )
    )
      return;
    cancelEvent(event.id);
    setRevision((revision) => revision + 1);
  }

  return (
    <section className="shell" style={{ padding: "40px 0 64px" }}>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span className="eyebrow-tag">organizer console</span>
          <h1 style={{ fontSize: 30, marginTop: 10 }}>Manage your events</h1>
          <p style={{ marginTop: 8 }}>
            Create and maintain events posted by you.
          </p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>
          + New event
        </button>
      </div>

      {notice && (
        <p role="status" style={{ marginBottom: 16, color: "var(--green)" }}>
          {notice}
        </p>
      )}

      {isFormOpen && (
        <form
          onSubmit={submitEvent}
          className="card-surface"
          style={{
            padding: 20,
            marginBottom: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
        <h2 style={{ gridColumn: "1 / -1", fontSize: 19 }}>
          {editingId ? "Edit event" : "New event"}
        </h2>
        <label className="organizer-field">
          Event name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="organizer-field">
          Date and time
          <input
            required
            type="datetime-local"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label className="organizer-field">
          Registration closes
          <input
            required
            type="datetime-local"
            max={form.date || undefined}
            value={form.registrationDeadline}
            onChange={(e) =>
              setForm({ ...form, registrationDeadline: e.target.value })
            }
          />
        </label>
        <label className="organizer-field">
          Venue
          <input
            required
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
        </label>
        <label className="organizer-field">
          Category
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as EventCategory })
            }
          >
            {CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="organizer-field">
          Capacity
          <input
            required
            type="number"
            min="1"
            step="1"
            value={form.capacity}
            onChange={(e) =>
              setForm({ ...form, capacity: Number(e.target.value) })
            }
          />
        </label>
        <label className="organizer-field" style={{ gridColumn: "1 / -1" }}>
          Description
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        {formError && (
          <p
            role="alert"
            style={{ gridColumn: "1 / -1", color: "var(--rust)" }}
          >
            {formError}
          </p>
        )}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
          <button className="btn btn-primary" type="submit">
            {editingId ? "Save changes" : "Create event"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setIsFormOpen(false);
              setEditingId(null);
              setFormError("");
            }}
          >
            Cancel
          </button>
        </div>
        </form>
      )}

      {selectedEvent ? (
        <OrganizerEventDetails
          event={selectedEvent}
          onBack={() => setSelectedEventId(null)}
        />
      ) : myEvents.length === 0 ? (
        <EmptyState
          title="No events posted yet"
          description="Once you create an event, it'll show up here."
        />
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myEvents.map((event) => {
            const status = event.cancelled
              ? "cancelled"
              : isRegistrationClosed(event)
                ? "closed"
                : event.seatsAvailable <= 0
                ? "full"
                : "open";
            return (
              <li
                key={event.id}
                className="card-surface"
                role="button"
                tabIndex={0}
                aria-label={`View details for ${event.name}`}
                onClick={() => openEventDetails(event)}
                onKeyDown={(keyboardEvent) =>
                  handleEventRowKeyDown(keyboardEvent, event)
                }
                style={{
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: 17,
                    }}
                  >
                    {event.name}
                  </span>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--ink-soft)",
                      marginTop: 4,
                    }}
                  >
                    {new Date(event.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {event.venue} · {event.seatsAvailable}/{event.capacity}{" "}
                    seats
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <StatusBadge status={status} />
                  {!event.cancelled && (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          startEdit(event);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          handleCancel(event);
                        }}
                      >
                        Cancel event
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function OrganizerEventDetails({
  event,
  onBack,
}: {
  event: CampusEvent;
  onBack: () => void;
}) {
  const confirmedRegistrations = registrations.filter(
    (registration) =>
      registration.eventId === event.id && registration.status === "confirmed",
  );
  const registeredCount = event.capacity - event.seatsAvailable;
  const registrationRate = event.capacity
    ? Math.round((registeredCount / event.capacity) * 100)
    : 0;
  const status = event.cancelled
    ? "cancelled"
    : isRegistrationClosed(event)
      ? "closed"
      : event.seatsAvailable <= 0
        ? "full"
        : "open";

  return (
    <section aria-labelledby="event-details-title">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to events
        </button>
        <Link className="btn btn-secondary" href={`/events/${event.id}`}>
          View public page
        </Link>
      </div>

      <div className="card-surface" style={{ padding: 24, marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="eyebrow-tag">event overview</span>
            <h2 id="event-details-title" style={{ fontSize: 28, marginTop: 10 }}>
              {event.name}
            </h2>
            <p style={{ marginTop: 8, maxWidth: 680 }}>{event.description}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 24,
          }}
        >
          <DetailStat label="Registered" value={String(registeredCount)} />
          <DetailStat label="Capacity" value={String(event.capacity)} />
          <DetailStat label="Seats left" value={String(event.seatsAvailable)} />
          <DetailStat label="Filled" value={`${registrationRate}%`} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
            color: "var(--ink-soft)",
          }}
        >
          <div>
            <strong style={{ color: "var(--ink)" }}>When</strong>
            <div style={{ marginTop: 4 }}>
              {new Date(event.date).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          </div>
          <div>
            <strong style={{ color: "var(--ink)" }}>Where</strong>
            <div style={{ marginTop: 4 }}>{event.venue}</div>
          </div>
          <div>
            <strong style={{ color: "var(--ink)" }}>Category</strong>
            <div style={{ marginTop: 4 }}>{event.category}</div>
          </div>
        </div>
      </div>

      <div className="card-surface" style={{ padding: 24, marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: 21 }}>Registered students</h2>
            <p style={{ marginTop: 5 }}>
              Confirmed attendee records for this event.
            </p>
          </div>
          <span className="eyebrow-tag">
            {confirmedRegistrations.length} attendee record
            {confirmedRegistrations.length === 1 ? "" : "s"}
          </span>
        </div>

        {confirmedRegistrations.length === 0 ? (
          <p style={{ marginTop: 20 }}>No individual registrations recorded yet.</p>
        ) : (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 10,
              marginTop: 20,
            }}
          >
            {confirmedRegistrations.map((registration) => {
              const student = getUserById(registration.studentId);
              return (
                <li
                  key={registration.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "12px 14px",
                  }}
                >
                  <strong>{student?.name ?? "Unknown student"}</strong>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                    Registered {new Date(registration.registeredAt).toLocaleDateString("en-IN")}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--slate-bg)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>
        {label}
      </div>
      <strong style={{ display: "block", fontSize: 26, marginTop: 3 }}>{value}</strong>
    </div>
  );
}
