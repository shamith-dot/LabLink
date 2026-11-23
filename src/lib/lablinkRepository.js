import { supabase } from "./supabase";
import { Beaker, Cpu, Gauge, Layers3, Microscope } from "lucide-react";

const presentationByName = {
  "Arduino Mega 2560": { icon: Cpu, tags: ["embedded", "sensor", "iot", "microcontroller", "electronics", "robotics"] },
  "Raspberry Pi 4": { icon: Cpu, tags: ["iot", "computer vision", "ai", "edge", "python", "embedded", "sensor"] },
  "Digital Oscilloscope": { icon: Gauge, tags: ["electronics", "signal", "waveform", "circuit", "measurement", "electrical"] },
  "3D Printer": { icon: Layers3, tags: ["prototype", "design", "mechanical", "manufacturing", "3d", "material"] },
  "FPGA Development Board": { icon: Cpu, tags: ["digital", "logic", "hardware", "computer science", "circuit", "signal"] },
  "Digital Multimeter": { icon: Gauge, tags: ["electrical", "measurement", "circuit", "voltage", "current", "electronics"] },
  "Thermal Camera": { icon: Microscope, tags: ["thermal", "energy", "materials", "diagnostics", "inspection", "heat"] },
  "Laser Cutter": { icon: Beaker, tags: ["prototype", "design", "fabrication", "manufacturing", "mechanical", "materials"] },
};

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  return supabase;
}
function normalizeStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
function normalizeTime(time) {
  return time?.slice(0, 5) || "08:00";
}
function normalizeEquipment(row) {
  const presentation = presentationByName[row.name] || { icon: Beaker, tags: [] };
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    department: row.department,
    lab: row.lab,
    stock: row.stock,
    description: row.description,
    tags: row.tags || presentation.tags,
    specs: row.specs || [],
    training: row.training,
    inspection: row.inspection,
    lead: `${row.lead_minutes} min`,
    icon: presentation.icon,
  };
}
function normalizeBooking(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    student: row.requester?.display_name || row.student_name || "Campus member",
    equipmentId: row.equipment_id,
    project: row.project || "Reserved slot",
    date: row.booking_date,
    startTime: normalizeTime(row.start_time),
    duration: Number(row.duration_hours),
    status: normalizeStatus(row.status),
    reviewNote: row.review_note,
    created: row.created_at?.slice(0, 10) || row.booking_date,
  };
}
function normalizeProject(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    student: row.requester?.display_name || row.student_name || "Campus member",
    name: row.name,
    course: row.course,
    faculty: row.faculty,
    details: row.details,
    status: normalizeStatus(row.status),
    reviewNote: row.review_note,
    created: row.created_at?.slice(0, 10) || "",
  };
}
function raise(operation, result) {
  if (result.error) {
    const error = new Error(`${operation}: ${result.error.message}`);
    error.code = result.error.code;
    throw error;
  }
  return result.data;
}

export async function getProfile(userId) {
  const client = requireClient();
  const result = await client.from("profiles").select("id, display_name, role, department").eq("id", userId).single();
  return raise("Loading user profile", result);
}

export async function loadWorkspace(role, userId, startDate, endDate) {
  const client = requireClient();
  const equipmentQuery = client.from("equipment").select("id, name, category, department, lab, stock, description, tags, specs, training, inspection, lead_minutes").eq("is_active", true).order("name");
  let bookingsQuery = client.from("bookings").select("id, student_id, equipment_id, project, booking_date, start_time, duration_hours, status, review_note, created_at, requester:profiles!bookings_student_id_fkey(display_name)");
  let projectsQuery = client.from("project_access_requests").select("id, student_id, name, course, faculty, details, status, review_note, created_at, requester:profiles!project_access_requests_student_id_fkey(display_name)");
  if (role === "faculty" || role === "admin") {
    bookingsQuery = bookingsQuery.order("created_at", { ascending: false });
    projectsQuery = projectsQuery.order("created_at", { ascending: false });
  } else {
    bookingsQuery = bookingsQuery.eq("student_id", userId).order("created_at", { ascending: false });
    projectsQuery = projectsQuery.eq("student_id", userId).order("created_at", { ascending: false });
  }
  const [equipmentResult, bookingsResult, projectsResult, scheduleResult] = await Promise.all([
    equipmentQuery,
    bookingsQuery,
    projectsQuery,
    client.rpc("get_equipment_schedule", { p_start_date: startDate, p_end_date: endDate }),
  ]);
  const equipmentRows = raise("Loading equipment", equipmentResult);
  const bookingRows = raise("Loading bookings", bookingsResult);
  const projectRows = raise("Loading project requests", projectsResult);
  const scheduleRows = raise("Loading availability", scheduleResult);
  const detailedBookings = bookingRows.map(normalizeBooking);
  const detailedById = new Map(detailedBookings.map((booking) => [booking.id, booking]));
  const scheduleBookings = scheduleRows.map((row) => {
    const detailed = detailedById.get(row.booking_id);
    return detailed || normalizeBooking({ ...row, project: "Reserved slot", student_name: "Campus member" });
  });
  return {
    equipment: equipmentRows.map(normalizeEquipment),
    bookings: scheduleBookings,
    projectRequests: projectRows.map(normalizeProject),
  };
}

export async function createBooking({ userId, equipmentId, project, date, startTime, duration }) {
  const client = requireClient();
  const row = {
    student_id: userId,
    equipment_id: equipmentId,
    project,
    booking_date: date,
    start_time: startTime,
    duration_hours: Number(duration),
    status: "pending",
  };
  const result = await client.from("bookings").insert(row).select("id, student_id, equipment_id, project, booking_date, start_time, duration_hours, status, review_note, created_at").single();
  return normalizeBooking(raise("Creating booking", result));
}

export async function cancelBooking(bookingId) {
  const client = requireClient();
  const result = await client.from("bookings").update({ status: "cancelled" }).eq("id", bookingId).select("id").single();
  raise("Cancelling booking", result);
}

export async function createProjectRequest({ userId, name, course, faculty, details }) {
  const client = requireClient();
  const result = await client.from("project_access_requests").insert({
    student_id: userId,
    name,
    course,
    faculty,
    details,
    status: "pending",
  }).select("id, student_id, name, course, faculty, details, status, review_note, created_at").single();
  return normalizeProject(raise("Creating project access request", result));
}

export async function decideRequest(kind, requestId, status, reason, reviewerId) {
  const client = requireClient();
  const table = kind === "booking" ? "bookings" : "project_access_requests";
  const result = await client.from(table).update({
    status,
    review_note: reason,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", requestId).eq("status", "pending").select("id").maybeSingle();
  const row = raise("Updating request status", result);
  if (!row) throw new Error("This request has already been reviewed or is no longer available.");
}

export async function getAvailability(equipmentId, date) {
  const client = requireClient();
  const result = await client.rpc("get_equipment_schedule", {
    p_start_date: date,
    p_end_date: date,
    p_equipment_id: equipmentId,
  });
  return raise("Checking equipment availability", result).map(normalizeBooking);
}
