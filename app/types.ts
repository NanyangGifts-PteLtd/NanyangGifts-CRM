import { Stringifier } from "postcss";

export type ClientStatus =
  | 'New Lead'
  | 'Contacted'
  | 'Quoted'
  | 'Failed'
  | 'Overdue'
  | 'Follow Up'
  | 'Shortlisted'
  | 'Project Started'
  | 'Project Done'
  | 'Closed'
  | 'Unqualified';

export type ReplyStatus =
  | 'Waiting...'
  | 'Replied'

export type SubitemStatus =
  | 'To Quote'
  | 'Verified'
  | 'Awarded'
  | 'Initial Quote'
  | 'Quoted'
  | 'Shortlisted'
  | 'Failed'
  | '';

export type PaymentStatus = 'Paid' | 'To Pay' | 'Partial' | 'Overdue';
export type TimelineProgress = 'Not Started' | 'Started' | 'Done';
export type SampleStatus = 'Ready to collect' | 'Return arranged' | "Extended" | 'Chased'| 'Must return' | 'Request to not return' | 'No return needed'|'Failed'| 'Overdue';
export type SampleType = 'Product sample' | 'Pre-production sample';
export type SampleOrderStatus = 'Pending'| 'To order'| 'Ordered'| 'Delivered'| 'Paid'| 'Shipped'| 'Failed';

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url?: string | null
}

export interface SampleRow {
  status: string;
  type: string;
  returnByDate: string;
  returnedDate: string;
  sentDate: string;
}

export interface TimelineRow {
  id: string;
  name: string;
  person: string;
  remarks: string;
  subProgress: TimelineProgress | string;
  timelineStart: string;
  timelineEnd: string;
  duration: string;
  dependency: string;
}


export interface Subitem {
  id: string;
  name: string;
  people: string;
  status: SubitemStatus | string;
  localOverseas: string;
  qty: string;
  description: string;
  remarks: string;
  shipper: string;
  supplier: string;
  cost: string;
  manpower: string;
  ls: string;
  os: string;
  tc: string;
  uc: string;
  tcSgd: string;
  price: string;
  up: string;
  numOfCartons: string;
  cnTracking: string;
  sgTracking: string;
  
  // Payment fields
  owner: string;
  paymentStatus: PaymentStatus | string;
  total: string;
  lsRmb: string;
  totalC: string;
  modeOfPayment: string;
  orderNumber: string;
  quantityProduced: string;
  sample: string;
  qtyFor: string;
  paymentAmount: string;
  difference: string;
  paymentRemarks: string;
  // Timeline
  timelineRows: TimelineRow[];
  showTimeline: boolean;
  showPayments: boolean;
  showSample: boolean;
  //Sample
  sampleRows: SampleRow[];
  sampleOrderStatus: SampleOrderStatus | string;
  sampleStatus: SampleStatus | string;
  sampleType: SampleType | string;
}

export type ActivityEntry = {
  id: string,
  action: "field_changed" | "subitem_added" | "subitem_deleted" | "subitem_field_changed";
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorName: string;
  createdAt: string;
  subitemId?: string;
  subitemName?: string;
}

export interface Client {
  id: string;
  name: string;
  people: string;
  replyStatus: string;
  followUp: string;
  status: ClientStatus;
  channel: string;
  importance: string;
  company: string;
  email: string;
  phone: string;
  requirements: string;
  qty: string;
  nbd: string;
  totalPrice: string;
  companyAddress: string;
  dateCreated: string;
  billingAddress: string;
  expanded: boolean;
  color: string;
  subitems: Subitem[];
  activityLog?: ActivityEntry[];
  assignedProfileIds?: string[];
}
export type ClientAssigneeMap = Record<string, string[]>;

export type SubitemAssigneeMap = Record<string, string[]>;


export interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  clientId?: string;
}

export interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
}