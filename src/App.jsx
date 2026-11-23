import { createElement, useEffect, useState } from "react";
import {
  AlertCircle, ArrowDownWideNarrow, ArrowLeft, ArrowRight, ArrowUpRight,
  BadgeCheck, Beaker, Bell, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, Clock3, Cpu, FlaskConical, Gauge, Layers3,
  Lightbulb, ListFilter, MapPin, Menu, Microscope, PackageCheck, Plus,
  Search, Settings2, ShieldCheck, Sparkles, X, XCircle,
} from "lucide-react";
import "./App.css";
import AuthDialog from "./components/AuthDialog";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { cancelBooking as cancelRemoteBooking, createBooking as createRemoteBooking, createProjectRequest as createRemoteProjectRequest, decideRequest, getAvailability as getRemoteAvailability, getProfile, loadWorkspace } from "./lib/lablinkRepository";

const CURRENT_STUDENT = "Alex Morgan";
const STORAGE_KEYS = { bookings: "lablink.bookings.v2", projects: "lablink.projects.v2" };
const EQUIPMENT = [
  { id: 1, name: "Arduino Mega 2560", category: "Development Kits", department: "Electronics", lab: "IoT Laboratory", stock: 12, description: "Microcontroller development board for embedded systems, sensor networks, and rapid prototyping.", icon: Cpu, tags: ["embedded", "sensor", "iot", "microcontroller", "electronics", "robotics"], specs: ["ATmega2560 · 16 MHz", "54 digital I/O pins", "USB and 12 V input"], training: "Introductory orientation", inspection: "Inspected Nov 14, 2026", lead: "10 min" },
  { id: 2, name: "Raspberry Pi 4", category: "Development Kits", department: "Computer Science", lab: "Innovation Lab", stock: 6, description: "Single-board computer for edge computing, computer vision, and connected campus prototypes.", icon: Cpu, tags: ["iot", "computer vision", "ai", "edge", "python", "embedded", "sensor"], specs: ["8 GB RAM · Quad-core", "Dual micro-HDMI", "Wi-Fi 5 and Bluetooth 5.0"], training: "Self-guided quick start", inspection: "Inspected Nov 18, 2026", lead: "5 min" },
  { id: 3, name: "Digital Oscilloscope", category: "Instruments", department: "Electronics", lab: "Electronics Lab", stock: 4, description: "Four-channel signal measurement and waveform analysis for electronics research and teaching.", icon: Gauge, tags: ["electronics", "signal", "waveform", "circuit", "measurement", "electrical"], specs: ["4 channels · 100 MHz", "1 GSa/s real-time", "USB data export"], training: "Bench safety orientation", inspection: "Calibrated Nov 12, 2026", lead: "15 min" },
  { id: 4, name: "3D Printer", category: "Machines", department: "Mechanical", lab: "Maker Space", stock: 2, description: "FDM printing for functional prototypes, enclosures, fixtures, and iterative product design.", icon: Layers3, tags: ["prototype", "design", "mechanical", "manufacturing", "3d", "material"], specs: ["Build volume · 256 mm³", "PLA, PETG, TPU", "0.4 mm nozzle"], training: "Maker Space orientation", inspection: "Serviced Nov 16, 2026", lead: "20 min" },
  { id: 5, name: "FPGA Development Board", category: "Development Kits", department: "Computer Science", lab: "VLSI Lab", stock: 8, description: "Programmable logic platform for digital circuits, hardware acceleration, and embedded design.", icon: Cpu, tags: ["digital", "logic", "hardware", "computer science", "circuit", "signal"], specs: ["Artix-7 FPGA", "DDR3 memory · 512 MB", "HDMI and Ethernet"], training: "VLSI lab induction", inspection: "Inspected Nov 11, 2026", lead: "10 min" },
  { id: 6, name: "Digital Multimeter", category: "Instruments", department: "Electrical", lab: "Electrical Lab", stock: 15, description: "Handheld measurement of voltage, current, resistance, continuity, and diode response.", icon: Gauge, tags: ["electrical", "measurement", "circuit", "voltage", "current", "electronics"], specs: ["True RMS measurement", "CAT III 600 V", "Auto-ranging"], training: "Basic lab safety", inspection: "Inspected Nov 19, 2026", lead: "5 min" },
  { id: 7, name: "Thermal Camera", category: "Instruments", department: "Mechanical", lab: "Materials Lab", stock: 3, description: "Infrared imaging for thermal analysis, energy audits, and equipment diagnostics.", icon: Microscope, tags: ["thermal", "energy", "materials", "diagnostics", "inspection", "heat"], specs: ["160 × 120 resolution", "-20 °C to 400 °C", "Radiometric JPEG capture"], training: "Thermal handling briefing", inspection: "Calibrated Nov 10, 2026", lead: "10 min" },
  { id: 8, name: "Laser Cutter", category: "Machines", department: "Mechanical", lab: "Maker Space", stock: 1, description: "Enclosed CO₂ laser cutter for precise fabrication of approved sheet materials and prototypes.", icon: Beaker, tags: ["prototype", "design", "fabrication", "manufacturing", "mechanical", "materials"], specs: ["60 W CO₂ laser", "Work area · 600 × 400 mm", "Enclosed with extraction"], training: "Certified operator required", inspection: "Serviced Nov 17, 2026", lead: "25 min" },
];
const NAVIGATION = [
  { label: "Dashboard", icon: Layers3 },
  { label: "Explore Equipment", icon: Search },
  { label: "My Bookings", icon: CalendarDays },
  { label: "Project Access", icon: FlaskConical },
  { label: "Availability Calendar", icon: CalendarDays },
  { label: "Faculty Approvals", icon: ShieldCheck },
  { label: "Resource Planner", icon: Sparkles },
];
const CATEGORIES = ["All categories", "Development Kits", "Instruments", "Machines"];
const DEPARTMENTS = ["All departments", ...new Set(EQUIPMENT.map((item) => item.department))];
const DAY_START = 8;
const DAY_END = 18;

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(days, start = new Date()) {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  date.setDate(date.getDate() + days);
  return localDate(date);
}
function dateAtNoon(value) {
  return new Date(`${value}T12:00:00`);
}
function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  return value ? dateAtNoon(value).toLocaleDateString("en-US", options) : "Not scheduled";
}
function readStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function createSampleBookings() {
  return [
    { id: "sample-1", student: CURRENT_STUDENT, equipmentId: 3, project: "Low-noise sensor interface", date: addDays(1), startTime: "10:00", duration: 2, status: "Pending", created: addDays(0) },
    { id: "sample-2", student: "Jordan Lee", equipmentId: 2, project: "Campus air quality monitor", date: addDays(3), startTime: "13:00", duration: 3, status: "Approved", created: addDays(-1) },
    { id: "sample-3", student: "Sam Rivera", equipmentId: 4, project: "Assistive grip prototype", date: addDays(5), startTime: "09:00", duration: 6, status: "Pending", created: addDays(0) },
  ];
}
function createSampleProjects() {
  return [{ id: "project-sample", name: "Campus air quality monitor", course: "BIOE 210 · Smart Environments", faculty: "Dr. Elena Garcia", details: "Shared sensor kits and edge-computing equipment for a campus pilot.", status: "Approved", created: addDays(-4), reviewNote: "Approved for the current term." }];
}
function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
function reservationsConflict(equipmentId, date, startTime, duration, bookings, excludeId) {
  const start = toMinutes(startTime);
  const end = start + Number(duration) * 60;
  return bookings.some((booking) => {
    if (booking.id === excludeId || booking.equipmentId !== equipmentId || booking.date !== date || ["Rejected", "Cancelled"].includes(booking.status)) return false;
    const existingStart = toMinutes(booking.startTime);
    const existingEnd = existingStart + Number(booking.duration) * 60;
    return start < existingEnd && existingStart < end;
  });
}
function findNextOpenSlot(equipmentId, startDate, endDate, duration, bookings) {
  const from = dateAtNoon(startDate);
  const until = dateAtNoon(endDate);
  for (const candidate = new Date(from); candidate <= until; candidate.setDate(candidate.getDate() + 1)) {
    const date = localDate(candidate);
    const now = new Date();
    const earliestHour = date === localDate() ? Math.max(DAY_START, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 60)) : DAY_START;
    for (let hour = earliestHour; hour + Number(duration) <= DAY_END; hour += 1) {
      const startTime = `${String(hour).padStart(2, "0")}:00`;
      if (!reservationsConflict(equipmentId, date, startTime, duration, bookings)) return { date, startTime };
    }
  }
  return null;
}
function bookingInterval(booking) {
  const end = toMinutes(booking.startTime) + Number(booking.duration) * 60;
  return `${booking.startTime}–${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
function getAvailability(equipmentItem, date, time, duration, bookings) {
  if (!date || !time || !duration) return { available: null, conflict: null };
  const conflict = bookings.find((booking) => booking.equipmentId === equipmentItem.id && booking.date === date && !["Rejected", "Cancelled"].includes(booking.status) && toMinutes(time) < toMinutes(booking.startTime) + Number(booking.duration) * 60 && toMinutes(booking.startTime) < toMinutes(time) + Number(duration) * 60);
  return { available: !conflict, conflict };
}
function StatusPill({ status }) {
  const statusClass = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${statusClass}`}><span className="status-dot" />{status}</span>;
}
function EmptyState({ icon: Icon = PackageCheck, title, description, action, onAction }) {
  return <div className="empty-state"><span className="empty-icon">{createElement(Icon, { size: 20 })}</span><h3>{title}</h3><p>{description}</p>{action && <button className="button button-secondary" onClick={onAction}>{action}</button>}</div>;
}
function PageHeading({ eyebrow, title, description, action, onAction, actionIcon: ActionIcon = Plus }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <button className="button button-primary" onClick={onAction}>{createElement(ActionIcon, { size: 15 })}{action}</button>}</div>;
}
function EquipmentCard({ item, availability, onBook }) {
  const Icon = item.icon;
  return <article className="equipment-card">
    <div className="equipment-card-top"><div className="equipment-symbol">{createElement(Icon, { size: 20, strokeWidth: 1.7 })}</div><StatusPill status={availability === 0 ? "Fully reserved" : "Available"} /></div>
    <span className="eyebrow">{item.category} <span className="eyebrow-divider">/</span> {item.department}</span>
    <h3>{item.name}</h3><p className="equipment-description">{item.description}</p>
    <div className="equipment-facts"><span><MapPin size={13} />{item.lab}</span><span><PackageCheck size={13} />{item.stock} catalog units</span></div>
    <div className="equipment-card-actions"><button className="button button-secondary" aria-label={`View ${item.name} details`} onClick={() => onBook(item)}>Details</button><button className="button button-primary" aria-label={`Request a ${item.name} slot`} onClick={() => onBook(item)}>Request slot<ArrowRight size={14} /></button></div>
  </article>;
}
function App() {
  const [page, setPage] = useState("Dashboard");
  const [bookings, setBookings] = useState(() => readStored(STORAGE_KEYS.bookings, createSampleBookings()));
  const [projectRequests, setProjectRequests] = useState(() => readStored(STORAGE_KEYS.projects, createSampleProjects()));
  const [equipmentItems, setEquipmentItems] = useState(EQUIPMENT);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [backendMode, setBackendMode] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [remoteAvailability, setRemoteAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [department, setDepartment] = useState("All departments");
  const [availabilityFilter, setAvailabilityFilter] = useState("Any availability");
  const [sortBy, setSortBy] = useState("Name A–Z");
  const [selected, setSelected] = useState(null);
  const [bookingForm, setBookingForm] = useState({ project: "", date: "", startTime: "09:00", duration: "2" });
  const [projectForm, setProjectForm] = useState({ name: "", course: "", faculty: "", details: "" });
  const [bookingFilter, setBookingFilter] = useState("All statuses");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarDate, setCalendarDate] = useState(addDays(1));
  const [calendarEquipment, setCalendarEquipment] = useState("All equipment");
  const [plannerForm, setPlannerForm] = useState({ requirements: "", deadline: addDays(14), duration: "2" });
  const [plannerResults, setPlannerResults] = useState(null);
  const [reviewDecision, setReviewDecision] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const [notice, setNotice] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const displayName = profile?.display_name || CURRENT_STUDENT;
  const isReviewer = !backendMode || ["faculty", "admin"].includes(profile?.role);
  const personalBookings = bookings.filter((booking) => backendMode ? booking.studentId === session?.user?.id : booking.student === CURRENT_STUDENT);
  const pendingCount = (backendMode && !isReviewer ? 0 : bookings.filter((booking) => booking.status === "Pending").length) + (backendMode && !isReviewer ? 0 : projectRequests.filter((request) => request.status === "Pending").length);
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setProfile(null);
      if (!nextSession) {
        setBackendMode(false);
        setEquipmentItems(EQUIPMENT);
        setBookings(readStored(STORAGE_KEYS.bookings, createSampleBookings()));
        setProjectRequests(readStored(STORAGE_KEYS.projects, createSampleProjects()));
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setBackendError(error.message);
      setSession(data.session);
      setAuthReady(true);
    }).catch((error) => {
      if (active) {
        setBackendError(error.message || "Unable to read the saved Supabase session.");
        setAuthReady(true);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return undefined;
    let active = true;
    const startDate = localDate(new Date(calendarYear, calendarMonthIndex, 1));
    const endDate = localDate(new Date(calendarYear, calendarMonthIndex + 1, 0));
    setBackendError("");
    getProfile(session.user.id).then(async (remoteProfile) => {
      const workspace = await loadWorkspace(remoteProfile.role, session.user.id, startDate, endDate);
      if (!active) return;
      setProfile(remoteProfile);
      setEquipmentItems(workspace.equipment.length ? workspace.equipment : EQUIPMENT);
      setBookings(workspace.bookings);
      setProjectRequests(workspace.projectRequests);
      setBackendMode(true);
    }).catch((error) => {
      if (!active) return;
      setBackendMode(false);
      setBackendError(error.message || "Supabase is unavailable. LabLink is using local demo data.");
    });
    return () => { active = false; };
  }, [session?.user?.id, calendarYear, calendarMonthIndex]);

  useEffect(() => {
    if (!backendMode || !selected || !bookingForm.date) {
      setRemoteAvailability([]);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return undefined;
    }
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError("");
    getRemoteAvailability(selected.id, bookingForm.date).then((rows) => {
      if (active) setRemoteAvailability(rows);
    }).catch((error) => {
      if (active) setAvailabilityError(error.message || "Availability could not be verified.");
    }).finally(() => {
      if (active) setAvailabilityLoading(false);
    });
    return () => { active = false; };
  }, [backendMode, selected?.id, bookingForm.date]);

  useEffect(() => {
    if (backendMode) return;
    try {
      localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(bookings));
    } catch {
      setNotice({ message: "Browser storage is unavailable. Changes may not survive a refresh.", type: "error", id: Date.now() });
    }
  }, [bookings, backendMode]);
  useEffect(() => {
    if (backendMode) return;
    try {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projectRequests));
    } catch {
      setNotice({ message: "Browser storage is unavailable. Changes may not survive a refresh.", type: "error", id: Date.now() });
    }
  }, [projectRequests, backendMode]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const notify = (message, type = "success") => setNotice({ message, type, id: Date.now() });
  const getItem = (id) => equipmentItems.find((item) => String(item.id) === String(id));
  const availabilityCount = (item) => findNextOpenSlot(item.id, localDate(), addDays(14), 1, bookings) ? item.stock : 0;

  const filteredEquipment = equipmentItems.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesText = !query || [item.name, item.category, item.department, item.lab, item.description, ...item.tags].some((value) => value.toLowerCase().includes(query));
    const matchesCategory = category === "All categories" || item.category === category;
    const matchesDepartment = department === "All departments" || item.department === department;
    const matchesAvailability = availabilityFilter === "Any availability" || (availabilityFilter === "Available" ? availabilityCount(item) > 0 : availabilityCount(item) === 0);
    return matchesText && matchesCategory && matchesDepartment && matchesAvailability;
  }).sort((a, b) => sortBy === "Name A–Z" ? a.name.localeCompare(b.name) : sortBy === "Most units" ? b.stock - a.stock : a.category.localeCompare(b.category));

  const openBooking = (item, preset = {}) => {
    setSelected(item);
    setBookingForm({ project: preset.project || "", date: preset.date || "", startTime: preset.startTime || "09:00", duration: String(preset.duration || "2") });
  };
  const submitBooking = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const normalizedProject = bookingForm.project.trim();
    if (normalizedProject.length < 3) return notify("Enter a project name with at least 3 characters.", "error");
    if (!bookingForm.date || bookingForm.date < localDate()) return notify("Choose today or a future date for the booking.", "error");
    const duration = Number(bookingForm.duration);
    if (!Number.isInteger(duration) || duration < 1 || duration > 8) return notify("Duration must be between 1 and 8 whole hours.", "error");
    const startMinutes = toMinutes(bookingForm.startTime);
    const currentTime = new Date();
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    if (startMinutes % 60 !== 0 || startMinutes < DAY_START * 60 || startMinutes + duration * 60 > DAY_END * 60) return notify("Choose a whole-hour slot that fits within lab hours (08:00–18:00).", "error");
    if (bookingForm.date === localDate() && startMinutes < currentMinutes) return notify("Choose a future time today or select another day.", "error");
    let reservations = bookings;
    if (backendMode) {
      try {
        reservations = [...bookings, ...await getRemoteAvailability(selected.id, bookingForm.date)];
      } catch (error) {
        setBackendMode(false);
        setBackendError(error.message || "Availability could not be checked. Local demo data is available.");
        return notify("Live availability could not be checked, so this request was not submitted. Try again in demo mode or reconnect.", "error");
      }
    }
    if (reservationsConflict(selected.id, bookingForm.date, bookingForm.startTime, duration, reservations)) return notify("That time overlaps an existing reservation. Choose another slot.", "error");
    if (backendMode) {
      try {
        const savedBooking = await createRemoteBooking({ userId: session.user.id, equipmentId: selected.id, project: normalizedProject, date: bookingForm.date, startTime: bookingForm.startTime, duration });
        setBookings((current) => [...current, { ...savedBooking, student: displayName, studentId: session.user.id }]);
        setSelected(null);
        setPage("My Bookings");
        notify("Booking request saved to Supabase and sent for faculty review.");
        return;
      } catch (error) {
        if (error.code === "23P01" || error.code === "23514") return notify("The slot was just reserved or violates lab-hour rules. Refresh availability and choose another time.", "error");
        setBackendMode(false);
        setBackendError(error.message || "Supabase could not save the request. Local demo mode is available.");
        return notify("Supabase could not confirm the save. No local booking was created; check My Bookings before retrying.", "error");
      }
    }
    const nextBooking = { id: `booking-${Date.now()}`, student: CURRENT_STUDENT, equipmentId: selected.id, project: normalizedProject, date: bookingForm.date, startTime: bookingForm.startTime, duration, status: "Pending", created: localDate() };
    setBookings((current) => [...current, nextBooking]);
    setSelected(null);
    setPage("My Bookings");
    notify("Booking request submitted. It is now awaiting faculty review.");
  };
  const cancelBooking = async (booking) => {
    if (booking.status !== "Pending") return notify("Only pending requests can be cancelled.", "error");
    if (backendMode) {
      try {
        await cancelRemoteBooking(booking.id);
        setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "Cancelled", reviewNote: "Cancelled by requester." } : item));
        return notify("Pending booking cancelled in Supabase.");
      } catch (error) {
        return notify(error.message || "Booking could not be cancelled.", "error");
      }
    }
    setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "Cancelled", reviewNote: "Cancelled by requester." } : item));
    notify("Pending booking cancelled.");
  };
  const submitProjectRequest = async (event) => {
    event.preventDefault();
    const name = projectForm.name.trim();
    const course = projectForm.course.trim();
    const faculty = projectForm.faculty.trim();
    if (name.length < 3 || course.length < 3 || faculty.length < 3) return notify("Project, course, and faculty sponsor must each have at least 3 characters.", "error");
    if (projectRequests.some((request) => request.name.toLowerCase() === name.toLowerCase() && (backendMode ? request.studentId === session?.user?.id : request.student === CURRENT_STUDENT) && request.status !== "Rejected")) return notify("You already have an active request for this project.", "error");
    if (backendMode) {
      try {
        const savedRequest = await createRemoteProjectRequest({ userId: session.user.id, name, course, faculty, details: projectForm.details.trim() });
        setProjectRequests((current) => [{ ...savedRequest, student: displayName, studentId: session.user.id }, ...current]);
        setProjectForm({ name: "", course: "", faculty: "", details: "" });
        return notify("Project access request saved to Supabase for faculty review.");
      } catch (error) {
        return notify(error.message || "Project access request could not be saved.", "error");
      }
    }
    setProjectRequests((current) => [{ ...projectForm, name, course, faculty, id: `project-${Date.now()}`, student: CURRENT_STUDENT, status: "Pending", created: localDate() }, ...current]);
    setProjectForm({ name: "", course: "", faculty: "", details: "" });
    notify("Project request submitted for faculty review.");
  };
  const approveItem = async (kind, id) => {
    if (backendMode) {
      try {
        await decideRequest(kind, id, "approved", "Approved by faculty.", session.user.id);
        const update = (item) => item.id === id ? { ...item, status: "Approved", reviewNote: "Approved by faculty.", reviewedAt: localDate() } : item;
        if (kind === "booking") setBookings((current) => current.map(update));
        else setProjectRequests((current) => current.map(update));
        return notify(kind === "booking" ? "Booking approval saved to Supabase." : "Project access approval saved to Supabase.");
      } catch (error) {
        return notify(error.message || "Approval could not be saved.", "error");
      }
    }
    const review = { status: "Approved", reviewNote: "Approved by faculty.", reviewedAt: localDate() };
    if (kind === "booking") setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, ...review } : booking));
    else setProjectRequests((current) => current.map((request) => request.id === id ? { ...request, ...review } : request));
    notify(kind === "booking" ? "Booking approved." : "Project access approved.");
  };
  const rejectItem = async (event) => {
    event.preventDefault();
    const reason = reviewReason.trim();
    if (reason.length < 8) return notify("Add a short reason (at least 8 characters) so the requester knows what to change.", "error");
    if (backendMode) {
      try {
        await decideRequest(reviewDecision.kind, reviewDecision.id, "rejected", reason, session.user.id);
        const update = (item) => item.id === reviewDecision.id ? { ...item, status: "Rejected", reviewNote: reason, reviewedAt: localDate() } : item;
        if (reviewDecision.kind === "booking") setBookings((current) => current.map(update));
        else setProjectRequests((current) => current.map(update));
        setReviewDecision(null);
        setReviewReason("");
        return notify("Decline and faculty feedback saved to Supabase.");
      } catch (error) {
        return notify(error.message || "Decline could not be saved.", "error");
      }
    }
    const update = (item) => item.id === reviewDecision.id ? { ...item, status: "Rejected", reviewNote: reason, reviewedAt: localDate() } : item;
    if (reviewDecision.kind === "booking") setBookings((current) => current.map(update));
    else setProjectRequests((current) => current.map(update));
    setReviewDecision(null);
    setReviewReason("");
    notify("Request declined and the reason was recorded.");
  };
  const runPlanner = (event) => {
    event.preventDefault();
    const requirements = plannerForm.requirements.trim();
    const duration = Number(plannerForm.duration);
    if (requirements.length < 4) return notify("Describe the project or equipment you need in a few words.", "error");
    if (!plannerForm.deadline || plannerForm.deadline < localDate()) return notify("Choose a deadline today or later.", "error");
    if (!Number.isInteger(duration) || duration < 1 || duration > 8) return notify("Choose a duration from 1 to 8 hours.", "error");
    const words = requirements.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
    const results = equipmentItems.map((item) => {
      const matched = item.tags.filter((tag) => tag.split(/[^a-z0-9]+/).some((tagWord) => words.some((word) => tagWord === word || (tagWord.length >= 4 && word.startsWith(tagWord)) || (word.length >= 4 && tagWord.startsWith(word)))));
      const slot = findNextOpenSlot(item.id, localDate(), plannerForm.deadline, duration, bookings);
      return { item, matched, slot, score: matched.length * 3 + (slot ? 2 : 0) + Math.min(item.stock, 5) / 10 };
    }).filter((result) => result.slot).sort((a, b) => b.score - a.score || a.slot.date.localeCompare(b.slot.date)).slice(0, 4);
    setPlannerResults({ requirements, duration, deadline: plannerForm.deadline, results });
    if (!results.length) notify("No matching open slots were found before that deadline. Try a later date or shorter duration.", "error");
  };
  const openPlannerRecommendation = (result) => {
    openBooking(result.item, { project: plannerResults.requirements.slice(0, 80), ...result.slot, duration: plannerResults.duration });
  };
  const goTo = (label) => { setPage(label); setMobileMenuOpen(false); };
  const modalAvailability = selected ? getAvailability(selected, bookingForm.date, bookingForm.startTime, bookingForm.duration, [...bookings, ...remoteAvailability]) : { available: null, conflict: null };
  const calendarBookings = bookings.filter((booking) => booking.date === calendarDate && booking.status !== "Rejected" && booking.status !== "Cancelled" && (calendarEquipment === "All equipment" || String(booking.equipmentId) === calendarEquipment));
  const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const monthOffset = (firstOfMonth.getDay() + 6) % 7;
  const dateBookings = (date) => bookings.filter((booking) => booking.date === date && booking.status !== "Rejected" && booking.status !== "Cancelled" && (calendarEquipment === "All equipment" || String(booking.equipmentId) === calendarEquipment));

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
      <button className="brand" onClick={() => goTo("Dashboard")} aria-label="LabLink dashboard"><span className="brand-mark"><FlaskConical size={21} /></span><span><strong>LabLink</strong><small>RESEARCH, CONNECTED</small></span></button>
      <div className="nav-group-label">CAMPUS WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">{NAVIGATION.filter(({ label }) => label !== "Faculty Approvals" || isReviewer).map(({ label, icon }) => <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => goTo(label)} aria-current={page === label ? "page" : undefined}>{createElement(icon, { size: 17, strokeWidth: 1.8 })}<span>{label}</span>{label === "Faculty Approvals" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="side-note"><div className="side-note-icon"><Lightbulb size={15} /></div><strong>Shared labs, better ideas.</strong><p>Discover equipment and collaborate across campus.</p><button onClick={() => goTo("Explore Equipment")}>Browse inventory<ArrowUpRight size={13} /></button></div><div className="profile-row"><span className="avatar">{displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="profile-copy"><strong>{displayName}</strong><small>{backendMode ? `${profile?.role || "student"} account` : "Demo account"}</small></span><button className="icon-button profile-settings" aria-label={session ? "Sign out" : "Sign in"} title={session ? "Sign out" : "Sign in"} onClick={async () => { if (session) { const { error } = await supabase.auth.signOut(); if (error) notify(error.message, "error"); else notify("Signed out. Demo workspace restored.", "info"); } else if (isSupabaseConfigured) setAuthDialogOpen(true); else notify("Add Supabase URL and publishable key to enable sign-in.", "info"); }}><Settings2 size={16} /></button></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="topbar-start"><button className="icon-button mobile-menu-button" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button><div className="breadcrumb"><span>LabLink</span><ChevronRight size={13} /><strong>{page}</strong></div></div><div className="topbar-end"><span className="campus-status"><span className={`live-dot ${backendMode ? "live-dot-connected" : "live-dot-demo"}`} />{backendMode ? "Supabase connected" : "North Campus demo"}</span><span className="topbar-rule" />{isReviewer && <button className="icon-button notification-button" aria-label={`${pendingCount} pending approvals`} title={`${pendingCount} items awaiting review`} onClick={() => goTo("Faculty Approvals")}><Bell size={17} />{pendingCount > 0 && <i />}</button>}{session ? <button className="button button-secondary auth-top-button" onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) notify(error.message, "error"); else notify("Signed out. Demo workspace restored.", "info"); }}>Sign out</button> : isSupabaseConfigured && <button className="button button-secondary auth-top-button" onClick={() => setAuthDialogOpen(true)}>Sign in</button>}<span className="avatar avatar-small">{displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span></div></header>
      {backendError && <div className="backend-banner" role="status"><AlertCircle size={16} /><span><strong>Using local demo data.</strong> {backendError}</span><button className="text-button" onClick={() => { setBackendError(""); if (session?.user?.id) setSession({ ...session }); }}>Retry connection</button></div>}
      {!backendMode && isSupabaseConfigured && authReady && !session && !backendError && <div className="backend-banner demo-banner" role="status"><Beaker size={16} /><span><strong>Demo mode.</strong> Sign in to load live equipment and submit database-backed requests.</span><button className="text-button" onClick={() => setAuthDialogOpen(true)}>Sign in</button></div>}
      <main className="page-content">
        {page === "Dashboard" && <DashboardPage bookings={personalBookings} pendingCount={pendingCount} equipment={equipmentItems} availabilityCount={availabilityCount} onNavigate={goTo} onBook={openBooking} onSelect={(item) => openBooking(item)} displayName={displayName} />}
        {page === "Explore Equipment" && <section><PageHeading eyebrow="CAMPUS EQUIPMENT DIRECTORY" title="Explore equipment" description="Search shared resources across teaching labs, maker spaces, and research facilities." action="Open resource planner" actionIcon={Sparkles} onAction={() => goTo("Resource Planner")} /><div className="inventory-toolbar"><label className="search-control"><Search size={16} /><input aria-label="Search equipment" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by equipment, lab, department, or capability" />{search && <button className="search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label><label className="select-control"><ListFilter size={14} /><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="select-control"><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="select-control"><select aria-label="Filter by availability" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}><option>Any availability</option><option>Available</option><option>Fully reserved</option></select></label><label className="select-control sort-control"><ArrowDownWideNarrow size={14} /><select aria-label="Sort equipment" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option>Recommended</option><option>Name A–Z</option><option>Most units</option></select></label></div><div className="results-line"><span><strong>{filteredEquipment.length}</strong> resources</span><span>Availability shown for upcoming reservations</span></div>{filteredEquipment.length ? <div className="equipment-grid">{filteredEquipment.map((item) => <EquipmentCard key={item.id} item={item} availability={availabilityCount(item)} onSelect={setSelected} onBook={openBooking} />)}</div> : <EmptyState icon={Search} title="No matching resources" description="Try removing a filter or using a broader search term." action="Clear filters" onAction={() => { setSearch(""); setCategory("All categories"); setDepartment("All departments"); setAvailabilityFilter("Any availability"); }} />}</section>}
        {page === "My Bookings" && <BookingsPage bookings={personalBookings} getItem={getItem} filter={bookingFilter} onFilter={setBookingFilter} onCancel={cancelBooking} onExplore={() => goTo("Explore Equipment")} />}
        {page === "Project Access" && <ProjectAccessPage projectForm={projectForm} setProjectForm={setProjectForm} requests={projectRequests.filter((request) => backendMode ? request.studentId === session?.user?.id : request.student === CURRENT_STUDENT)} onSubmit={submitProjectRequest} onBrowse={() => goTo("Explore Equipment")} />}
        {page === "Availability Calendar" && <section><PageHeading eyebrow="LAB OPERATIONS" title="Availability calendar" description="See campus reservations by day and equipment. Select a date to review booked slots." /><div className="calendar-toolbar"><div className="month-control"><button className="icon-button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><h2>{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button className="icon-button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div><label className="select-control calendar-equipment-filter"><span>Equipment</span><select aria-label="Calendar equipment filter" value={calendarEquipment} onChange={(event) => setCalendarEquipment(event.target.value)}><option value="All equipment">All equipment</option>{EQUIPMENT.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="calendar-layout"><div className="calendar-card"><div className="weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="days-grid">{Array.from({ length: monthOffset }, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}{Array.from({ length: monthDays }, (_, index) => { const day = index + 1; const key = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const count = dateBookings(key).length; return <button key={key} className={`calendar-day ${calendarDate === key ? "selected-day" : ""} ${key === localDate() ? "today" : ""}`} onClick={() => setCalendarDate(key)} aria-label={`${formatDate(key)}${count ? `, ${count} reservations` : ", no reservations"}`} aria-pressed={calendarDate === key}><span className="calendar-day-number">{day}</span>{count > 0 && <span className="calendar-day-count">{count} {count === 1 ? "slot" : "slots"}</span>}</button>; })}</div><div className="calendar-legend"><span><i className="legend-dot booked" />Reservations</span><span><i className="legend-dot open" />Open day</span></div></div><aside className="day-panel"><div className="day-panel-heading"><span className="eyebrow">SELECTED DAY</span><h2>{formatDate(calendarDate, { weekday: "long", month: "long", day: "numeric" })}</h2><p>{calendarBookings.length} reservation{calendarBookings.length === 1 ? "" : "s"}</p></div>{calendarBookings.length ? <div className="day-booking-list">{calendarBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((booking) => { const item = getItem(booking.equipmentId); return <article className="day-booking" key={booking.id}><span className="day-booking-time"><Clock3 size={13} />{bookingInterval(booking)}</span><strong>{item?.name || "Equipment"}</strong><span>{booking.project}</span><StatusPill status={booking.status} /></article>; })}</div> : <EmptyState icon={CalendarDays} title="No reservations" description="There are no bookings for this date and filter." />}<button className="button button-primary day-book-button" onClick={() => goTo("Explore Equipment")}>Explore available equipment<ArrowRight size={14} /></button></aside></div><section className="calendar-guidance"><Sparkles size={17} /><div><strong>Need a clear slot?</strong><p>Open any equipment detail and LabLink will check overlaps and suggest the next available time before your deadline.</p></div><button className="button button-secondary" onClick={() => goTo("Resource Planner")}>Plan a project</button></section></section>}
        {page === "Faculty Approvals" && isReviewer && <FacultyPage bookings={bookings} projects={projectRequests} getItem={getItem} onApprove={approveItem} onReject={(kind, id) => { setReviewDecision({ kind, id }); setReviewReason(""); }} />}
        {page === "Resource Planner" && <PlannerPage form={plannerForm} setForm={setPlannerForm} results={plannerResults} onSubmit={runPlanner} onBook={openPlannerRecommendation} onExplore={() => goTo("Explore Equipment")} />}
        <footer className="site-footer"><span>LabLink · North Campus Research Resources</span><span>Prototype workspace · Sample data is stored in this browser</span></footer>
      </main>
    </div>
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="modal equipment-modal" role="dialog" aria-modal="true" aria-labelledby="equipment-modal-title"><button className="icon-button modal-close" aria-label="Close equipment details" onClick={() => setSelected(null)}><X size={17} /></button><div className="modal-equipment-top"><span className="equipment-symbol modal-equipment-symbol"><selected.icon size={22} strokeWidth={1.7} /></span><div><span className="eyebrow">{selected.category} · {selected.department}</span><h2 id="equipment-modal-title">{selected.name}</h2></div></div><p className="modal-description">{selected.description}</p><div className="detail-grid"><div><span>Location</span><strong><MapPin size={13} />{selected.lab}</strong></div><div><span>Inventory</span><strong><PackageCheck size={13} />{selected.stock} units</strong></div><div><span>Setup time</span><strong><Clock3 size={13} />{selected.lead}</strong></div><div><span>Training</span><strong><ShieldCheck size={13} />{selected.training}</strong></div><div className="detail-wide"><span>Last inspection</span><strong>{selected.inspection}</strong></div></div><div className="spec-list"><h3>Specifications</h3>{selected.specs.map((spec) => <span key={spec}><Check size={13} />{spec}</span>)}</div><div className="booking-form-heading"><div><span className="eyebrow">RESERVE EQUIPMENT</span><h3>Request a time slot</h3></div><span className="lab-hours">Lab hours 08:00–18:00</span></div><form className="booking-form" onSubmit={submitBooking}><label className="form-field field-wide">Project name<input autoFocus required minLength={3} maxLength={100} value={bookingForm.project} onChange={(event) => setBookingForm({ ...bookingForm, project: event.target.value })} placeholder="e.g. Portable soil sensor" /></label><label className="form-field">Date<input required type="date" min={localDate()} value={bookingForm.date} onChange={(event) => setBookingForm({ ...bookingForm, date: event.target.value })} /></label><label className="form-field">Start time<input required type="time" min="08:00" max="17:00" step="3600" value={bookingForm.startTime} onChange={(event) => setBookingForm({ ...bookingForm, startTime: event.target.value })} /></label><label className="form-field">Duration<select required value={bookingForm.duration} onChange={(event) => setBookingForm({ ...bookingForm, duration: event.target.value })}>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "hour" : "hours"}</option>)}</select></label><div className={`slot-indicator ${modalAvailability.available === false ? "slot-conflict" : modalAvailability.available ? "slot-open" : "slot-neutral"}`} aria-live="polite">{modalAvailability.available === false ? <><AlertCircle size={16} /><span><strong>Time overlap</strong>{` ${getItem(modalAvailability.conflict?.equipmentId)?.name || selected.name} is reserved ${bookingInterval(modalAvailability.conflict)}.`}</span></> : modalAvailability.available ? <><CheckCircle2 size={16} /><span><strong>Slot looks open</strong>Faculty approval is still required to confirm this request.</span></> : <><Clock3 size={16} /><span><strong>Choose a date and time</strong>Availability updates as you enter a slot.</span></>}</div>{modalAvailability.available === false && <button className="text-button suggested-slot" type="button" onClick={() => { const suggestion = findNextOpenSlot(selected.id, bookingForm.date, addDays(14, dateAtNoon(bookingForm.date)), bookingForm.duration, bookings); if (!suggestion) return notify("No open slots found in the next 14 days.", "error"); setBookingForm({ ...bookingForm, ...suggestion }); notify(`Suggested open slot: ${formatDate(suggestion.date)}, ${suggestion.startTime}.`, "info"); }}>Find next open slot<ArrowRight size={13} /></button>}<button className="button button-primary booking-submit" type="submit" disabled={modalAvailability.available === false}>Submit for faculty approval<ArrowRight size={15} /></button></form></section></div>}
    {reviewDecision && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewDecision(null); }}><section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title"><button className="icon-button modal-close" aria-label="Close decline dialog" onClick={() => setReviewDecision(null)}><X size={17} /></button><span className="review-modal-icon"><XCircle size={20} /></span><span className="eyebrow">FACULTY REVIEW</span><h2 id="review-modal-title">Decline this request?</h2><p>The student will see your reason in their request status.</p><form onSubmit={rejectItem}><label className="form-field">Reason for declining<textarea required minLength={8} maxLength={300} rows={4} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Explain what needs to change or why access cannot be approved." /></label><span className="character-count">{reviewReason.length}/300 · 8 characters minimum</span><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setReviewDecision(null)}>Keep request open</button><button className="button button-danger" type="submit">Confirm decline</button></div></form></section></div>}
    {authDialogOpen && <AuthDialog onClose={() => setAuthDialogOpen(false)} onMessage={notify} />}
    {notice && <div className={`toast toast-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}><span className="toast-icon">{notice.type === "error" ? <AlertCircle size={17} /> : notice.type === "info" ? <Lightbulb size={17} /> : <CheckCircle2 size={17} />}</span><span>{notice.message}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button></div>}
  </div>;
}

function DashboardPage({ bookings, pendingCount, equipment, availabilityCount, onNavigate, onBook, onSelect }) {
  const upcoming = bookings.filter((booking) => booking.status === "Approved" || booking.status === "Pending").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return <section><div className="welcome-panel"><div className="welcome-copy"><span className="eyebrow">MONDAY, NOVEMBER 23 · NORTH CAMPUS</span><h1>Research starts here, Alex.</h1><p>Shared equipment, connected labs, more room to experiment.</p><div className="welcome-actions"><button className="button button-primary" onClick={() => onNavigate("Explore Equipment")}><Search size={15} />Explore resources</button><button className="welcome-text-link" onClick={() => onNavigate("Resource Planner")}><Sparkles size={14} />Plan a project</button></div></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><span className="art-core"><FlaskConical size={31} strokeWidth={1.4} /></span><span className="art-node node-one"><Cpu size={15} /></span><span className="art-node node-two"><Gauge size={15} /></span><span className="art-node node-three"><Layers3 size={15} /></span></div></div><div className="stats-grid"><StatCard label="Catalog resources" value={equipment.length} note="Across 4 departments" icon={PackageCheck} accent="green" /><StatCard label="Available units" value={equipment.reduce((sum, item) => sum + availabilityCount(item), 0)} note="Based on upcoming requests" icon={Beaker} accent="blue" /><StatCard label="My requests" value={bookings.length} note={`${bookings.filter((booking) => booking.status === "Approved").length} approved · ${bookings.filter((booking) => booking.status === "Pending").length} pending`} icon={CalendarDays} accent="amber" /><StatCard label="Awaiting review" value={pendingCount} note="Faculty approval queue" icon={Clock3} accent="coral" /></div><div className="dashboard-section-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Next steps</h2></div><button className="text-button" onClick={() => onNavigate("My Bookings")}>View my requests<ArrowRight size={13} /></button></div><div className="dashboard-columns"><div className="workflow-list"><button className="workflow-row" onClick={() => onNavigate("Explore Equipment")}><span className="workflow-icon green-icon"><Search size={17} /></span><span><strong>Explore shared equipment</strong><small>Search by capability, department, or lab location.</small></span><ArrowRight size={16} /></button><button className="workflow-row" onClick={() => onNavigate("Resource Planner")}><span className="workflow-icon amber-icon"><Sparkles size={17} /></span><span><strong>Match resources to a project</strong><small>Get slot-aware suggestions based on your requirements.</small></span><ArrowRight size={16} /></button><button className="workflow-row" onClick={() => onNavigate("Project Access")}><span className="workflow-icon blue-icon"><FlaskConical size={17} /></span><span><strong>Request project access</strong><small>Share your project plan with a faculty sponsor.</small></span><ArrowRight size={16} /></button></div><div className="upcoming-panel"><div className="upcoming-heading"><div><span className="eyebrow">PERSONAL SCHEDULE</span><h3>Upcoming requests</h3></div><button className="icon-button" aria-label="View all bookings" onClick={() => onNavigate("My Bookings")}><ArrowUpRight size={16} /></button></div>{upcoming.length ? upcoming.map((booking) => { const item = equipment.find((candidate) => candidate.id === booking.equipmentId); return <div className="upcoming-row" key={booking.id}><span className="upcoming-date"><strong>{new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-US", { day: "2-digit" })}</strong><small>{new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</small></span><span className="upcoming-info"><strong>{item?.name || "Equipment request"}</strong><small>{booking.project} · {booking.startTime}</small></span><StatusPill status={booking.status} /></div>; }) : <p className="upcoming-empty">No upcoming requests. Start with a resource search.</p>}</div></div><div className="dashboard-section-heading featured-heading"><div><span className="eyebrow">POPULAR ON CAMPUS</span><h2>Featured equipment</h2></div><button className="text-button" onClick={() => onNavigate("Explore Equipment")}>Browse all {equipment.length}<ArrowRight size={13} /></button></div><div className="equipment-grid dashboard-equipment-grid">{equipment.slice(0, 3).map((item) => <EquipmentCard key={item.id} item={item} availability={availabilityCount(item)} onSelect={onSelect} onBook={onBook} />)}</div></section>;
}
function StatCard({ label, value, note, icon: Icon, accent }) {
  const caption = label === "Available units" ? "Bookable within 14 days" : note;
  return <article className={`stat-card stat-${accent}`}><span className="stat-icon">{createElement(Icon, { size: 17 })}</span><span className="stat-label">{label}</span><strong>{value}</strong><small>{caption}</small></article>;
}
function BookingsPage({ bookings, getItem, filter, onFilter, onCancel, onExplore }) {
  const visible = filter === "All statuses" ? bookings : bookings.filter((booking) => booking.status === filter);
  return <section><PageHeading eyebrow="STUDENT WORKSPACE" title="My bookings" description="Review your requests, scheduled slots, and faculty decisions." action="Find equipment" onAction={onExplore} /><div className="booking-summary-row"><span><strong>{bookings.length}</strong> total requests</span><span><strong>{bookings.filter((booking) => booking.status === "Approved").length}</strong> approved</span><span><strong>{bookings.filter((booking) => booking.status === "Pending").length}</strong> pending review</span><label className="select-control booking-status-filter"><span>Show</span><select aria-label="Filter bookings by status" value={filter} onChange={(event) => onFilter(event.target.value)}>{["All statuses", "Pending", "Approved", "Rejected", "Cancelled"].map((status) => <option key={status}>{status}</option>)}</select></label></div>{visible.length ? <div className="booking-table-wrap"><table className="data-table"><thead><tr><th>RESOURCE</th><th>PROJECT</th><th>DATE &amp; TIME</th><th>DURATION</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((booking) => { const item = getItem(booking.equipmentId); return <tr key={booking.id}><td><span className="table-primary">{item?.name || "Equipment"}</span><span className="table-secondary">{item?.lab || "Campus lab"}</span></td><td><span className="table-primary">{booking.project}</span></td><td><span className="table-primary">{formatDate(booking.date, { month: "short", day: "numeric", year: "numeric" })}</span><span className="table-secondary">{bookingInterval(booking)}</span></td><td>{booking.duration} {booking.duration === 1 ? "hour" : "hours"}</td><td><StatusPill status={booking.status} />{booking.reviewNote && <span className="table-secondary review-note">{booking.reviewNote}</span>}</td><td>{booking.status === "Pending" && <button className="table-action" onClick={() => onCancel(booking)}>Cancel request</button>}</td></tr>; })}</tbody></table></div> : <EmptyState icon={CalendarDays} title={filter === "All statuses" ? "No bookings yet" : `No ${filter.toLowerCase()} bookings`} description={filter === "All statuses" ? "Your equipment requests will appear here after you reserve a time slot." : "Choose another status filter to see more requests."} action="Explore equipment" onAction={onExplore} />}</section>;
}
function ProjectAccessPage({ projectForm, setProjectForm, requests, onSubmit, onBrowse }) {
  return <section><PageHeading eyebrow="RESEARCH WORKSPACE" title="Project access" description="Tell faculty what you are building and the shared lab resources your team needs." action="Explore equipment" actionIcon={Search} onAction={onBrowse} /><div className="project-page-layout"><form className="panel project-form" onSubmit={onSubmit}><div className="panel-heading"><span className="panel-icon"><FlaskConical size={17} /></span><div><h2>New access request</h2><p>Requests are visible to the faculty review team.</p></div></div><label className="form-field">Project name<input required minLength={3} maxLength={100} value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="e.g. Portable soil sensor" /></label><label className="form-field">Course or research group<input required minLength={3} maxLength={100} value={projectForm.course} onChange={(event) => setProjectForm({ ...projectForm, course: event.target.value })} placeholder="e.g. ENGR 302 · Embedded Systems" /></label><label className="form-field">Faculty sponsor<input required minLength={3} maxLength={100} value={projectForm.faculty} onChange={(event) => setProjectForm({ ...projectForm, faculty: event.target.value })} placeholder="Faculty name" /></label><label className="form-field">Resources and project purpose<textarea maxLength={500} rows={4} value={projectForm.details} onChange={(event) => setProjectForm({ ...projectForm, details: event.target.value })} placeholder="What facilities or equipment will your project need?" /></label><span className="form-hint">Include safety training or special access needs if relevant.</span><button className="button button-primary form-submit" type="submit">Send for faculty review<ArrowRight size={15} /></button></form><section className="project-requests"><div className="section-title-row"><div><span className="eyebrow">ACCESS TRACKER</span><h2>Your requests</h2></div><span className="result-total">{requests.length} total</span></div>{requests.length ? requests.map((request) => <article className="project-request-card" key={request.id}><div className="project-request-heading"><div><span className="eyebrow">{request.course}</span><h3>{request.name}</h3></div><StatusPill status={request.status} /></div><p>Faculty sponsor · {request.faculty}</p>{request.details && <p className="request-detail">{request.details}</p>}{request.reviewNote && <div className={`review-feedback ${request.status === "Rejected" ? "feedback-rejected" : ""}`}><strong>{request.status === "Rejected" ? "Faculty feedback" : "Approval note"}</strong><span>{request.reviewNote}</span></div>}<span className="request-date">Submitted {formatDate(request.created, { month: "short", day: "numeric" })}</span></article>) : <EmptyState icon={FlaskConical} title="No access requests" description="Start an access request when your project needs shared facilities." />}</section></div></section>;
}
function FacultyPage({ bookings, projects, getItem, onApprove, onReject }) {
  const [queueFilter, setQueueFilter] = useState("Needs review");
  const bookingQueue = bookings.map((booking) => ({ ...booking, kind: "booking", item: getItem(booking.equipmentId) }));
  const projectQueue = projects.map((request) => ({ ...request, kind: "project" }));
  const allRequests = [...bookingQueue, ...projectQueue].sort((a, b) => a.created.localeCompare(b.created));
  const queue = queueFilter === "Needs review" ? allRequests.filter((request) => request.status === "Pending") : queueFilter === "All statuses" ? allRequests : allRequests.filter((request) => request.status === queueFilter);
  return <section><PageHeading eyebrow="FACULTY WORKSPACE" title="Approval queue" description="Review student equipment reservations and project access requests." /><div className="faculty-summary"><div><span className="faculty-summary-icon"><Clock3 size={17} /></span><span><strong>{allRequests.filter((request) => request.status === "Pending").length}</strong><small>Awaiting review</small></span></div><div><span className="faculty-summary-icon approved-icon"><BadgeCheck size={17} /></span><span><strong>{allRequests.filter((request) => request.status === "Approved").length}</strong><small>Approved</small></span></div><div><span className="faculty-summary-icon declined-icon"><XCircle size={17} /></span><span><strong>{allRequests.filter((request) => request.status === "Rejected").length}</strong><small>Declined</small></span></div></div><div className="section-title-row faculty-queue-heading"><div><span className="eyebrow">REQUEST MANAGEMENT</span><h2>Requests</h2></div><label className="select-control"><span>Show</span><select aria-label="Filter approval queue" value={queueFilter} onChange={(event) => setQueueFilter(event.target.value)}><option>Needs review</option><option>Approved</option><option>Rejected</option><option>All statuses</option></select></label></div>{queue.length ? <div className="approval-list">{queue.map((request) => <article className="approval-card" key={`${request.kind}-${request.id}`}><div className="approval-card-main"><span className={`approval-kind ${request.kind === "booking" ? "kind-booking" : "kind-project"}`}>{request.kind === "booking" ? <CalendarDays size={13} /> : <FlaskConical size={13} />}{request.kind === "booking" ? "Equipment booking" : "Project access"}</span><div className="approval-card-title"><div><h3>{request.kind === "booking" ? request.item?.name : request.name}</h3><p>{request.student} · {request.project || request.course}</p></div><StatusPill status={request.status} /></div>{request.kind === "booking" ? <div className="approval-detail-grid"><span><CalendarDays size={13} />{formatDate(request.date)}</span><span><Clock3 size={13} />{bookingInterval(request)} · {request.duration}h</span><span><MapPin size={13} />{request.item?.lab}</span></div> : <div className="approval-project-details"><span>Faculty sponsor · {request.faculty}</span>{request.details && <p>{request.details}</p>}</div>}{request.reviewNote && <div className="review-feedback"><strong>Recorded decision</strong><span>{request.reviewNote}</span></div>}</div>{request.status === "Pending" && <div className="approval-actions"><button className="button button-secondary" onClick={() => onReject(request.kind, request.id)}><XCircle size={14} />Decline</button><button className="button button-primary" onClick={() => onApprove(request.kind, request.id)}><Check size={14} />Approve</button></div>}</article>)}</div> : <EmptyState icon={queueFilter === "Needs review" ? CheckCircle2 : ListFilter} title={queueFilter === "Needs review" ? "Queue is clear" : `No ${queueFilter.toLowerCase()} requests`} description={queueFilter === "Needs review" ? "There are no requests waiting for faculty review." : "Try another queue filter to see requests."} />}</section>;
}
function PlannerPage({ form, setForm, results, onSubmit, onBook, onExplore }) {
  return (
    <section>
      <PageHeading eyebrow="SMART RESOURCE PLANNER" title="Plan your next experiment" description="Describe what you are working on, your deadline, and the time you need. See equipment matches with real open slots." />
      <div className="planner-layout">
        <form className="panel planner-form" onSubmit={onSubmit}>
          <div className="planner-form-header"><span className="planner-emblem"><Sparkles size={19} /></span><div><h2>Project requirements</h2><p>Recommendations are matched locally against the campus catalog and reservations.</p></div></div>
          <label className="form-field">What does your project need?<textarea required minLength={4} maxLength={400} rows={5} value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} placeholder="Try: build a wireless air quality sensor with temperature data and a 3D-printed enclosure" /></label>
          <div className="planner-fields">
            <label className="form-field">Target deadline<input required type="date" min={localDate()} value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
            <label className="form-field">Lab time needed<select value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "hour" : "hours"}</option>)}</select></label>
          </div>
          <div className="planner-privacy"><ShieldCheck size={15} /><span>Project descriptions stay in this browser. Matching uses equipment capabilities and current sample reservations.</span></div>
          <button className="button button-primary planner-submit" type="submit"><Sparkles size={15} />Find equipment and open slots</button>
        </form>
        <aside className="planner-aside">
          <span className="eyebrow">HOW MATCHING WORKS</span><h2>Relevant tools, realistic timing.</h2>
          <div className="matching-step"><span>01</span><p><strong>Capability match</strong>Project terms are compared with the equipment catalog.</p></div>
          <div className="matching-step"><span>02</span><p><strong>Deadline-aware</strong>Only open slots before your requested date are shown.</p></div>
          <div className="matching-step"><span>03</span><p><strong>Conflict checked</strong>Existing pending and approved reservations are respected.</p></div>
          <div className="planner-note"><Lightbulb size={15} /><p>Results are a local planning aid, not a connected generative AI service. Confirm training and lab access with faculty.</p></div>
        </aside>
      </div>
      {results && <section className="planner-results">
        <div className="section-title-row"><div><span className="eyebrow">SUGGESTED RESOURCES</span><h2>Best matches for your project</h2><p>“{results.requirements}” · {results.duration}h before {formatDate(results.deadline)}</p></div><span className="result-total">{results.results.length} options</span></div>
        {results.results.length ? <div className="recommendation-grid">{results.results.map(({ item, matched, slot }) => (
          <article className="recommendation-card" key={item.id}>
            <div className="recommendation-top"><span className="equipment-symbol">{createElement(item.icon, { size: 19 })}</span><span className="match-label"><Sparkles size={12} />{matched.length ? `${matched.length} capability match${matched.length === 1 ? "" : "es"}` : "Available option"}</span></div>
            <span className="eyebrow">{item.category} · {item.department}</span><h3>{item.name}</h3><p>{item.description}</p>
            <div className="match-reasons">{matched.length ? matched.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>) : <span>Open before deadline</span>}</div>
            <div className="recommended-slot"><CalendarDays size={14} /><span><strong>{formatDate(slot.date)}</strong><small>{slot.startTime} · {results.duration}h</small></span><StatusPill status="Available" /></div>
            <button className="button button-primary recommendation-action" onClick={() => onBook({ item, slot, duration: results.duration, project: results.requirements })}>Request this slot<ArrowRight size={14} /></button>
          </article>
        ))}</div> : <EmptyState icon={CalendarDays} title="No open slots before this deadline" description="Try a later deadline, shorter lab session, or different project terms." action="Browse equipment" onAction={onExplore} />}
      </section>}
    </section>
  );
}

export default App;
