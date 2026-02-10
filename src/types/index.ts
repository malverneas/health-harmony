export type UserRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  createdAt: Date;
}

export interface Patient extends User {
  role: 'patient';
  dateOfBirth?: Date;
  address?: string;
  bloodType?: string;
  allergies?: string[];
  medicalHistory?: string[];
}

export interface Doctor extends User {
  role: 'doctor';
  specialization: string;
  licenseNumber: string;
  hospital?: string;
  yearsOfExperience: number;
  rating?: number;
  consultationFee: number;
  availableSlots?: TimeSlot[];
}

export interface Pharmacist extends User {
  role: 'pharmacist';
  pharmacyName: string;
  pharmacyAddress: string;
  licenseNumber: string;
}

export interface Admin extends User {
  role: 'admin';
  department?: string;
  accessLevel: number;
}

export interface TimeSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  type: 'physical' | 'video' | 'voice' | 'chat';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduledAt: Date;
  duration?: number;
  notes?: string;
  diagnosis?: string;
  createdAt: Date;
}

export interface Prescription {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  pharmacyId?: string;
  medications: Medication[];
  instructions: string;
  status: 'pending' | 'sent-to-pharmacy' | 'in-stock' | 'out-of-stock' | 'preparing' | 'ready' | 'delivered' | 'collected';
  deliveryMethod?: 'pickup' | 'delivery';
  pdfUrl?: string;
  createdAt: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  notes?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'file' | 'prescription';
  fileUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalConsultations: number;
  totalPrescriptions: number;
  pendingOrders: number;
  activePatients?: number;
  revenue?: number;
}
